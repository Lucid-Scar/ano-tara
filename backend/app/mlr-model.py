import argparse
import shutil
import glob
import json
import sys
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pathlib import Path
from collections import defaultdict

import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score,mean_absolute_error,mean_squared_error

MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
BASE_FEATURES = ['lead_time','pax','pax_squared','length_of_stay','is_weekend','is_non_reference_room','hotel_is_resort','hotel_pax']
PSA_FEATURE = "psa_inflation_deviation_pp"
MONTH_REF = 'April'  # alphabetic reference: documented and stable
MONTH_OTHER = sorted(m for m in MONTHS if m != MONTH_REF)


def load_psa_yoy_by_year_month(xlsx_path):
    path=Path(xlsx_path)
    if not path.is_file():raise FileNotFoundError(f'PSA workbook unavailable: {path}')
    n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
       'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('xl/workbook.xml'))
        sheet=next((x for x in root.findall('m:sheets/m:sheet',n)
                    if x.attrib.get('name','').strip().lower()=='table 14'),None)
        if sheet is None:raise ValueError('PSA workbook must contain worksheet named `table 14`')
        relid=sheet.attrib['{'+n['r']+'}id']
        relroot=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel=next((x for x in relroot if x.attrib.get('Id')==relid),None)
        if rel is None:raise ValueError('Could not resolve worksheet table 14')
        target=rel.attrib['Target'].lstrip('/')
        if not target.startswith('xl/'):
            target='xl/'+target
        tab=ET.fromstring(z.read(target))
        cells={}
        for row in tab.findall('.//m:sheetData/m:row',n):
            for cell in row.findall('m:c',n):
                v=cell.find('m:v',n)
                if v is not None and v.text:
                    cells[cell.attrib['r']]=v.text
        out={}
        for row in range(8,150):
            raw_year=cells.get(f'A{row}')
            if not raw_year:continue
            try:year=int(float(raw_year))
            except (TypeError,ValueError):continue
            for month in range(1,13):
                col=chr(ord('B')+(month-1)*2)
                value=cells.get(f'{col}{row}')
                if value is None or not str(value).strip():continue
                try:rate=float(value)
                except ValueError:continue
                if not -50 <= rate <= 100:raise ValueError(f'Unexpected PSA YoY value: {year}-{month}: {rate}')
                out[(year,month)]=rate
    if not out:raise ValueError('No usable year-month PSA inflation values extracted from table 14')
    years=sorted({y for y,_ in out})
    print(f'PSA Table 14 loaded: {len(out)} monthly observations from {years[0]} to {years[-1]}')
    return out


def prepare_booking_frame(csv_file):
    required=['hotel','arrival_date_year','arrival_date_month','arrival_date_day_of_month',
              'lead_time','adults','children','stays_in_weekend_nights',
              'stays_in_week_nights','reserved_room_type','adr']
    df=pd.read_csv(csv_file,low_memory=False)
    missing=[x for x in required if x not in df.columns]
    if missing: raise ValueError(f'Missing booking columns: {missing}')
    df=df[required].copy()
    for c in ['arrival_date_year','arrival_date_day_of_month','lead_time','adults','children',
              'stays_in_weekend_nights','stays_in_week_nights','adr']:
        df[c]=pd.to_numeric(df[c],errors='coerce')
    df=df.dropna(subset=required)
    df=df[df.hotel.isin(['City Hotel','Resort Hotel']) & df.arrival_date_month.isin(MONTHS)]
    df=df[df.adr.between(0.01,999.99) & df.lead_time.ge(0)]
    df['pax']=df['adults']+df['children']
    df['length_of_stay']=df['stays_in_weekend_nights']+df['stays_in_week_nights']
    df=df[df.pax.gt(0) & df.length_of_stay.gt(0)].copy()
    num=df.arrival_date_month.map({m:i+1 for i,m in enumerate(MONTHS)})
    df['arrival_date']=pd.to_datetime(dict(year=df.arrival_date_year.astype(int),month=num.astype(int),
                                            day=df.arrival_date_day_of_month.astype(int)),errors='coerce')
    df=df.dropna(subset=['arrival_date']).copy()
    df['is_weekend']=df.arrival_date.dt.dayofweek.isin([4,5,6]).astype(int)
    df['hotel_is_resort']=df.hotel.eq('Resort Hotel').astype(int)
    df['is_non_reference_room']=df.reserved_room_type.ne('A').astype(int)
    df['hotel_pax']=df.hotel_is_resort*df.pax
    df['pax_squared']=df.pax**2
    df['month_name']=df.arrival_date.dt.month_name()
    return df.reset_index(drop=True)


def export_cleaned_data(source_csv, output_csv, mode, weather_profile=None, psa_rates=None):
    out = Path(output_csv)
    out.parent.mkdir(parents=True, exist_ok=True)
    raw_rows = sum(1 for _ in open(source_csv, encoding='utf-8', errors='replace')) - 1
    df = prepare_booking_frame(source_csv)
    if mode == 'weather':
        profile = weather_profile or {}
        months = df['arrival_date'].dt.month
        missing = sorted(set(months.unique()) - set(profile))
        if missing:
            raise ValueError(f'Missing measured weather profile for booking months: {missing}')
        df['avg_monthly_temp'] = months.map(lambda m: profile[int(m)]['avg_monthly_temp'])
        df['avg_monthly_rain'] = months.map(lambda m: profile[int(m)]['avg_monthly_rain'])
        df['hotel_temp'] = df['hotel_is_resort'] * df['avg_monthly_temp']
        df['hotel_rain'] = df['hotel_is_resort'] * df['avg_monthly_rain']

    if psa_rates is None:raise ValueError('PSA historical CPI mapping required for preprocessing')
    dates=list(zip(df.arrival_date.dt.year.astype(int),df.arrival_date.dt.month.astype(int)))
    rates=[psa_rates.get(date_key) for date_key in dates]
    if any(v is None for v in rates):
        missing=sorted(set(k for k,v in zip(dates,rates) if v is None))
        raise ValueError(f'PSA table 14 is missing historical booking year-months: {missing[:20]}')
    df['psa_inflation_rate'] = pd.Series(rates,index=df.index,dtype=float)
    df.to_csv(out, index=False)
    report = {
        'source_file': str(source_csv),
        'cleaned_file': str(out),
        'mode': mode,
        'raw_rows': int(raw_rows),
        'cleaned_rows': int(len(df)),
        'removed_rows': int(raw_rows - len(df)),
        'columns': list(df.columns),
        'preprocessing': [
            'Keep required booking columns and remove missing required values',
            'ADR strictly between 0 and 1000; lead time >= 0',
            'Recognized City Hotel / Resort Hotel and valid arrival dates',
            'Positive guest count and length of stay',
            'Derived pax, stay nights, weekend indicator, room and hotel indicators, interactions',
            'Weather mode: map independently observed Philippine month-of-year profile, not contemporaneous Portuguese weather',
            'Merge PSA All Items national CPI YoY (%) by actual source booking arrival year and month',
            'No target, split, fitted coefficients or model predictions computed during cleaning',
        ],
        'note': 'Historical PH national CPI YoY is a cross-domain macroeconomic proxy (NOT Portuguese inflation, NOT a PH hotel rate). The file is the actual training input; targets are formed after the train/test split to prevent baseline leakage.'
    }
    (out.parent/'cleaning_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Cleaned data saved: {out} ({len(df):,} rows of {raw_rows:,} original rows)')
    return out


def reload_cleaned_data(path, mode):
    """Read the exported CSV back from disk: this is what MLR training uses."""
    df = pd.read_csv(path, low_memory=False)
    df['arrival_date'] = pd.to_datetime(df['arrival_date'], errors='raise')
    required = BASE_FEATURES + ['hotel', 'month_name', 'adr', 'arrival_date','psa_inflation_rate']
    if mode == 'weather':
        required += ['avg_monthly_temp', 'avg_monthly_rain', 'hotel_temp', 'hotel_rain']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'cleaned.csv missing required model columns: {missing}')
    if df[required].isna().any().any():
        raise ValueError('cleaned.csv contains missing required values; re-run preprocessing')
    return df


def weather_dict(path):
    if not path: return {}
    df=pd.read_csv(path)
    if not {'month','avg_monthly_temp','avg_monthly_rain'}.issubset(df.columns):
        raise ValueError('Weather profile needs month, avg_monthly_temp, avg_monthly_rain')
    if 'quality_ok' in df.columns and not df['quality_ok'].astype(str).str.lower().eq('true').all():
        bad=df.loc[~df['quality_ok'].astype(str).str.lower().eq('true'),'month'].tolist()
        raise ValueError(f'Weather profile has inadequately observed months: {bad}. Provide more real observations.')
    vals={int(r.month):{'avg_monthly_temp':float(r.avg_monthly_temp),'avg_monthly_rain':float(r.avg_monthly_rain)}
          for r in df.itertuples(index=False)}
    if set(vals)!=set(range(1,13)):
        raise ValueError(f'Weather MLR mode requires all 12 months. Missing {sorted(set(range(1,13))-set(vals))}. '
                         'Use calendar mode until the full observed Bwandowando weather CSV is available.')
    return vals


def feature_names(mode):
    if mode == 'calendar':
        return BASE_FEATURES + [PSA_FEATURE] + [f'month_{x}' for x in MONTH_OTHER] + [f'resort_month_{x}' for x in MONTH_OTHER]
    if mode == 'weather':
        return BASE_FEATURES + [PSA_FEATURE] + ['avg_monthly_temp','avg_monthly_rain','hotel_temp','hotel_rain']
    raise ValueError(mode)


def build_features(df, mode, weather_profile=None, inflation_reference=None):
    X=df[BASE_FEATURES].copy().astype(float)
    if inflation_reference is None:raise ValueError('Training-set inflation reference is required')
    X[PSA_FEATURE] = df['psa_inflation_rate'].astype(float) - float(inflation_reference)
    if mode=='calendar':
        for m in MONTH_OTHER:
            X[f'month_{m}']=df.month_name.eq(m).astype(float)
            X[f'resort_month_{m}']=X[f'month_{m}']*df.hotel_is_resort.astype(float)
    elif mode=='weather':
        profile=weather_profile or {}
        months=df.arrival_date.dt.month
        if any(m not in profile for m in months.unique()):
            raise ValueError('Missing monthly measured weather values for training months')
        if {'avg_monthly_temp', 'avg_monthly_rain'}.issubset(df.columns):
            X['avg_monthly_temp'] = df['avg_monthly_temp'].astype(float)
            X['avg_monthly_rain'] = df['avg_monthly_rain'].astype(float)
        else:
            X['avg_monthly_temp']=months.map(lambda m:profile[m]['avg_monthly_temp']).astype(float)
            X['avg_monthly_rain']=months.map(lambda m:profile[m]['avg_monthly_rain']).astype(float)
        X['hotel_temp']=df.hotel_is_resort*X.avg_monthly_temp
        X['hotel_rain']=df.hotel_is_resort*X.avg_monthly_rain
    else:raise ValueError(mode)
    return X[feature_names(mode)].astype(float)


def source_baselines(training_df):
    med=training_df.groupby('hotel').adr.median().to_dict()
    if set(med)!={'City Hotel','Resort Hotel'}:
        raise ValueError('Need both City Hotel and Resort Hotel records in train split')
    return {k:float(v) for k,v in med.items()}


def targets(df, baselines):
    denom=df.hotel.map(baselines)
    ratio=df.adr/denom
    if not ratio.gt(0).all():raise ValueError('Target multiplier must be positive')
    return np.log(ratio.astype(float)),ratio.astype(float)


def inference_row(check_in,guests,length_of_stay,hotel_type,room_type,mode,weather_profile=None,lead_time=None):
    from datetime import date as date_class
    if isinstance(check_in,str):check_in=date_class.fromisoformat(check_in)
    if lead_time is None:lead_time=max(0,(check_in-date_class.today()).days)
    resort=int(hotel_type=='Resort Hotel');pax=max(1,int(guests))
    base={'lead_time':max(0,lead_time),'pax':pax,'pax_squared':pax**2,
          'length_of_stay':max(1,int(length_of_stay)),
          'is_weekend':int(check_in.weekday() in (4,5,6)),
          'is_non_reference_room':int(room_type!='Standard Room'),
          'hotel_is_resort':resort,'hotel_pax':resort*pax}
    features=dict(base)
    features[PSA_FEATURE] = 0.0
    month_name=check_in.strftime('%B')
    if mode=='calendar':
        for m in MONTH_OTHER:
            features['month_'+m]=int(month_name==m)
            features['resort_month_'+m]=resort*int(month_name==m)
    else:
        w=(weather_profile or {}).get(check_in.month)
        if not w:raise ValueError(f'No weather reference for month {check_in.month}')
        features.update(avg_monthly_temp=w['avg_monthly_temp'],avg_monthly_rain=w['avg_monthly_rain'],
                        hotel_temp=resort*w['avg_monthly_temp'],hotel_rain=resort*w['avg_monthly_rain'])
    return pd.DataFrame([features],columns=feature_names(mode)).astype(float)

from collections import defaultdict

TEMP_NAMES = ('temperature_2m','main.temp','temperature','temp')
RAIN_NAMES = ('rain.1h','precipitation','rain')


def weather_source_frame(path):
    """Read only required fields, in chunks to tolerate large multi-year files."""
    columns = list(pd.read_csv(path, nrows=0).columns)
    def first(candidates):
        return next((x for x in candidates if x in columns), None)
    t, r = first(TEMP_NAMES), first(RAIN_NAMES)
    if not {'city_name','datetime'}.issubset(columns) or not t or not r:
        raise ValueError(f'{path}: missing required city_name/datetime/temp/rain columns; found {columns[:25]}')
    fields = ['city_name','datetime',t,r]
    for chunk in pd.read_csv(path, usecols=fields, chunksize=200_000, low_memory=False):
        chunk = chunk.rename(columns={t:'temp_c',r:'rain_mm_hourly'})
        chunk['temp_c'] = pd.to_numeric(chunk['temp_c'],errors='coerce')
        chunk['rain_mm_hourly'] = pd.to_numeric(chunk['rain_mm_hourly'],errors='coerce').fillna(0)
        chunk['ts'] = pd.to_datetime(chunk['datetime'],errors='coerce',utc=True).dt.tz_convert('Asia/Manila')
        chunk['city_name'] = chunk['city_name'].astype(str).str.strip().str.casefold()
        chunk = chunk.dropna(subset=['temp_c','ts'])
        chunk = chunk[(chunk['temp_c'].between(-5,50)) & (chunk['rain_mm_hourly'].between(0,250))]
        # Reading at city/hour granularity: OpenWeather snapshot logs may repeat an hour.
        chunk['hour'] = chunk['ts'].dt.floor('h')
        chunk = chunk.sort_values('ts').drop_duplicates(['city_name','hour'],keep='last')
        yield chunk[['city_name','hour','temp_c','rain_mm_hourly']]


def build_profile(paths, out_dir):
    out_dir = Path(out_dir); out_dir.mkdir(parents=True,exist_ok=True)
    grouped = defaultdict(lambda: [0.,0.,0])
    observations = 0
    for p in paths:
        p=Path(p)
        for piece in weather_source_frame(p):
            piece=piece.copy()
            observations += len(piece)
            piece['year'] = piece['hour'].dt.year
            piece['month'] = piece['hour'].dt.month
            sums = piece.groupby(['city_name','year','month']).agg(temp_sum=('temp_c','sum'),rain_sum=('rain_mm_hourly','sum'),n=('temp_c','size'))
            for (city,year,month), row in sums.iterrows():
                acc=grouped[(city,int(year),int(month))]
                acc[0]+=float(row['temp_sum']);acc[1]+=float(row['rain_sum']);acc[2]+=int(row['n'])
        print(f'Processed {p.name}')
    if not grouped:
        raise RuntimeError('No valid weather data extracted.')
    city_rows=[]
    for (city,yr,mo),(ts,rs,n) in grouped.items():
        city_rows.append({'city_name':city,'year':yr,'month':mo,'avg_temp_c':ts/n,
                          'mean_hourly_rain_mm':rs/n,'hour_observations':n})
    city_year=pd.DataFrame(city_rows)
    city_month=city_year.groupby(['city_name','month'],as_index=False).agg(
        avg_temp_c=('avg_temp_c','mean'),mean_hourly_rain_mm=('mean_hourly_rain_mm','mean'),
        contributing_years=('year','nunique'),hour_observations=('hour_observations','sum'))
    monthly=city_month.groupby('month',as_index=False).agg(
        avg_monthly_temp=('avg_temp_c','mean'),avg_monthly_rain=('mean_hourly_rain_mm','mean'),
        cities=('city_name','nunique'),city_hour_observations=('hour_observations','sum'))
    monthly['avg_hourly_obs_per_city']=monthly['city_hour_observations']/monthly['cities']
    monthly['quality_ok']=(monthly['cities']>=50)&(monthly['avg_hourly_obs_per_city']>=120)
    monthly['month_name']=monthly['month'].map(lambda x:pd.Timestamp(2000,int(x),1).month_name())
    monthly=monthly[['month','month_name','avg_monthly_temp','avg_monthly_rain','cities','city_hour_observations','avg_hourly_obs_per_city','quality_ok']].sort_values('month')
    monthly.to_csv(out_dir/'weather_monthly_profile.csv',index=False)
    city_month.to_csv(out_dir/'weather_city_month_profile.csv',index=False)
    years=sorted(map(int,city_year.year.unique()))
    info={'weather_files':[str(p) for p in paths],'city_year_month_groups':len(city_year),
          'deduped_approx_hourly_records':int(observations),'months_present':monthly.month.astype(int).tolist(),
          'months_missing':sorted(set(range(1,13))-set(monthly.month)),
          'months_insufficient_coverage':monthly.loc[~monthly.quality_ok,'month'].astype(int).tolist(),
          'years_found':years,'cities_total':int(city_year.city_name.nunique()),
          'method':'city-hour snapshots deduplicated within chunks; city-year-month mean, equal mean across years and cities; rain is average observed hourly precipitation (mm/h), not monthly sum',
          'caveats':['Same city-hour spanning chunk boundaries may be counted twice; impact usually limited',
                     'Bwandowando temperature_2m and OpenWeather main.temp should be verified in Celsius',
                     'Weather values are PH calendar-month reference proxies, not contemporaneous Portuguese booking weather',
                     'Only observed months are exported; missing months are not fabricated']}
    (out_dir/'weather_provenance.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print(monthly.to_string(index=False));print('MISSING MONTHS:',info['months_missing'])
    return monthly



def report(y,pred,scope):
    return {'scope':scope,'n':int(len(y)), 'r2':float(r2_score(y,pred)),
            'mae_multiplier':float(mean_absolute_error(y,pred)),
            'rmse_multiplier':float(np.sqrt(mean_squared_error(y,pred)))}


def graph(y,p,filename,title,kind='scatter'):
    fig,ax=plt.subplots(figsize=(9,5.5))
    if kind=='scatter':
        ax.scatter(y,p,alpha=.18,s=9);lo=min(y.min(),p.min()); hi=max(y.max(),p.max())
        ax.plot([lo,hi],[lo,hi],linestyle='--',label='Perfect prediction (y=x)')
        ax.set_xlabel('Actual multiplier');ax.set_ylabel('Predicted multiplier');ax.legend()
    elif kind=='residual':
        ax.scatter(p,y-p,alpha=.18,s=8);ax.axhline(0,linestyle='--')
        ax.set_xlabel('Predicted multiplier');ax.set_ylabel('Residual (actual - predicted)')
    else:
        n=min(100,len(y));ax.plot(np.arange(n),y[:n],label='Actual',linewidth=1)
        ax.plot(np.arange(n),p[:n],label='Predicted',linewidth=1)
        ax.set_xlabel('Holdout sample index (NOT chronological)');ax.set_ylabel('Multiplier');ax.legend()
    ax.set_title(title);ax.grid(alpha=.2);fig.tight_layout();fig.savefig(filename,dpi=160);plt.close(fig)


def train(data,output,mode='calendar',weather_file=None,cleaned_file=None,psa_file=None):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    weather=weather_dict(weather_file) if mode=='weather' else {}
    if cleaned_file:
        cleaned_csv = Path(cleaned_file)
        if not cleaned_csv.is_file():
            raise FileNotFoundError(f'Previously cleaned dataset not found: {cleaned_csv}')
        if cleaned_csv.resolve() != (output/'cleaned.csv').resolve():
            shutil.copy2(cleaned_csv, output/'cleaned.csv')
            original_report = cleaned_csv.parent/'cleaning_report.json'
            if original_report.exists():
                shutil.copy2(original_report,output/'cleaning_report.json')
        cleaned_csv = output/'cleaned.csv'
        print(f'Reusing cleaned dataset for training: {cleaned_csv}')
    else:
        if not data:
            raise ValueError('Provide --bookings for preprocessing, or --cleaned for direct retraining')
        if not psa_file:raise ValueError('Provide --psa-inflation <PSA XLSX workbook> for training from raw bookings')
        psa_rates=load_psa_yoy_by_year_month(psa_file)
        cleaned_csv = export_cleaned_data(data, output/'cleaned.csv', mode, weather, psa_rates)
    df = reload_cleaned_data(cleaned_csv, mode)
    if len(df)<50000: print('WARNING: fewer than 50,000 cleaned rows; confirm you have the FULL hotel_bookings.csv, not a sample!',file=sys.stderr)
    tr,te=train_test_split(np.arange(len(df)),test_size=.2,random_state=0,
                           stratify=df.hotel if df.hotel.value_counts().min()>5 else None)
    train_df,test_df=df.iloc[tr],df.iloc[te]
    baselines=source_baselines(train_df)
    inflation_reference=float(train_df['psa_inflation_rate'].mean())
    Xtrain=build_features(train_df,mode,weather,inflation_reference);Xtest=build_features(test_df,mode,weather,inflation_reference)
    ytrain,train_m=targets(train_df,baselines);ytest,test_m=targets(test_df,baselines)
    model=LinearRegression().fit(Xtrain,ytrain)

    no_cpi_features=[c for c in Xtrain.columns if c!=PSA_FEATURE]
    without_cpi=LinearRegression().fit(Xtrain[no_cpi_features],ytrain)
    ablation_pred=np.exp(np.clip(without_cpi.predict(Xtest[no_cpi_features]),-15,15))
    predicted=np.exp(np.clip(model.predict(Xtest),-15,15))
    actual=np.asarray(test_m)
    prediction_csv=pd.DataFrame({'hotel':test_df.hotel.to_numpy(),'month':test_df.month_name.to_numpy(),
                   'actual_multiplier':actual,'predicted_multiplier':predicted,'residual':actual-predicted})
    prediction_csv.to_csv(output/'holdout_predictions.csv',index=False)
    pd.DataFrame([report(actual,predicted,'With PSA inflation proxy'),
                  report(actual,ablation_pred,'Without PSA inflation proxy')]).to_csv(output/'inflation_ablation.csv',index=False)
    model_metrics=[]
    for name,mask in [('Unified',np.ones(len(actual),dtype=bool)),
                      ('City Hotel',test_df.hotel.eq('City Hotel').to_numpy()),
                      ('Resort Hotel',test_df.hotel.eq('Resort Hotel').to_numpy())]:
        if mask.sum()<2: continue
        obs,preds=actual[mask],predicted[mask]
        model_metrics.append(report(obs,preds,name))
        suffix=name.lower().replace(' ','_')
        graph(obs,preds,output/f'scatter_{suffix}.png',f'{name}: actual versus predicted')
        graph(obs,preds,output/f'line_{suffix}.png',f'{name}: holdout samples',kind='line')
    graph(actual,predicted,output/'residuals_unified.png','Unified model: residual diagnostic',kind='residual')
    # Naive benchmark (always multiplier 1), same test records and train-only denominators.
    benchmark=report(actual,np.ones_like(actual),'Benchmark: source hotel median (multiplier=1)')
    all_metrics={'mode':mode,'cleaned_training_input':str(output/'cleaned.csv'),'samples_raw_cleaned':len(df),'train_n':len(tr),'test_n':len(te),
                 'model_metrics':model_metrics,'benchmark':benchmark,
                 'source_adr_medians':baselines,'psa_inflation_reference_training_mean_pct':inflation_reference,
                 'note':'R2 and MAE are from Portuguese booking holdout. Not Philippine cost validation.'}
    (output/'mlr_metrics.json').write_text(json.dumps(all_metrics,indent=2),encoding='utf-8')
    pd.DataFrame(model_metrics+[benchmark]).to_csv(output/'mlr_metrics.csv',index=False)

    design=Xtrain.copy();design['target_log_multiplier']=np.asarray(ytrain)
    design.to_csv(output/'train_design.csv',index=False)
    pd.DataFrame({'arrival_year_month':train_df.arrival_date.dt.strftime('%Y-%m').to_numpy()}).to_csv(output/'train_groups.csv',index=False)
    (output/'dataset_lineage.json').write_text(json.dumps({
        'raw_bookings': str(data) if data else 'previously exported cleaned.csv (see cleaning_report.json)',
        'actual_training_input': str(output/'cleaned.csv'),
        'training_design_for_OLS': str(output/'train_design.csv'),
        'source_baselines_fit_on': 'Training partition only',
        'split': 'Stratified 80/20 where possible; fixed seed=0',
        'psa_source': 'PSA national All Items CPI YoY monthly percent change; table 14',
        'psa_training_reference_pct': inflation_reference,
        'psa_runtime_policy': 'MLR feature is centered at training mean; runtime deviation fixed to 0, additive runtime inflation factor=1.0',
        'note': 'Use train_design.csv for OLS to match precisely the same fitted feature matrix and training records.'
    }, indent=2), encoding='utf-8')
    bundle={'model':model,'features':feature_names(mode),'mode':mode,'source_baselines':baselines,
            'source_dataset':'Antonio et al. Portuguese hotel bookings, 2015-2017',
            'weather_profile':weather,'holdout_metrics':model_metrics,'trained_rows':len(tr),
            'psa_inflation_reference_training_mean_pct':inflation_reference,
            'runtime_inflation_factor':1.0,
            'train_random_state':0,'model_role':'Indicative accommodation multiplier; not exact quote',
            'assumptions':{'source_room_type_A':'reference room; non-A mapped approximately to user non-standard room',
                           'baseline_for_target':'must be a typical undated PH rate, not already date-adjusted quote',
                           'rain':'PH historical climatological proxy if mode=weather, not Portuguese same-day rain',
                           'inflation':'PSA national CPI YoY matched by 2015-2017 year/month; cross-domain association only. Runtime CPI deviation 0; factor 1.0 to avoid additional PH inflation surcharge.'}}
    joblib.dump(bundle,output/'price_model_bundle.joblib')
    (output/'model_features.json').write_text(json.dumps(bundle['features'],indent=2),encoding='utf-8')
    print(json.dumps(all_metrics,indent=2))
    print('Saved cleaned dataset, model and figures:',output)
    return bundle,all_metrics



def find_observed_weather_files(folder):
    folder=Path(folder)
    patterns=['**/hourly_data_combined_2020_to_2023.csv',
              '**/*_CombinedData.csv']
    paths=[]
    for pattern in patterns:
        paths.extend(folder.glob(pattern))
    paths=sorted({p.resolve() for p in paths if p.is_file()})
    if not paths:
        raise FileNotFoundError(f'No original weather CSV files found under {folder}. '
            'Expected hourly_data_combined_2020_to_2023.csv or YYYYMM_CombinedData.csv')
    return paths


def main():
    a=argparse.ArgumentParser(description='Train Ano Tara relative accommodation multiplier MLR')
    a.add_argument('--bookings',help='FULL original hotel_bookings.csv (omit when --cleaned is given)')
    a.add_argument('--psa-inflation',help='PSA September 2026 CPI XLSX workbook; worksheet `table 14`; required when cleaning raw bookings')
    a.add_argument('--cleaned',help='Re-use a previously generated cleaned.csv as the training input')
    a.add_argument('--weather-profile',help='Use a previously exported real-data weather_monthly_profile.csv; skips re-aggregation')
    a.add_argument('--weather-dir',default='.',help='Folder containing Bwandowando/OpenWeather CSVs; recursive')
    a.add_argument('--mode',choices=['weather','calendar'],default='weather',
                   help='weather=PH measured calendar-month proxies; calendar=Portuguese arrival-month dummies')
    a.add_argument('--out',default='mlr_results',help='Outputs: saved joblib, graphs, and training design')
    args=a.parse_args()
    out=Path(args.out)
    weather_profile=None
    if not args.bookings and not args.cleaned:
        a.error('Provide either --bookings (preprocess from original CSV) or --cleaned (reuse the exported file)')
    if args.mode=='weather':
        if args.weather_profile or args.cleaned:
            weather_profile=Path(args.weather_profile) if args.weather_profile else Path(args.cleaned).parent/'weather_source'/'weather_monthly_profile.csv'
            if not weather_profile.is_file():
                raise FileNotFoundError(f'Weather-mode retraining needs the saved observed profile: {weather_profile}')
            print('Reusing measured weather profile:',weather_profile)
        else:
            files=find_observed_weather_files(args.weather_dir)
            print('Observed weather sources:')
            for f in files: print(' ',f)
            profile=build_profile(files,out/'weather_source')
            weather_profile=out/'weather_source'/'weather_monthly_profile.csv'
            if set(profile.month)!=set(range(1,13)) or not profile.quality_ok.astype(bool).all():
                missing=sorted(set(range(1,13))-set(profile.month))
                insufficient=profile.loc[~profile.quality_ok,'month'].tolist()
                raise ValueError(f'Cannot train weather-proxy MLR: missing months={missing}; '
                                 f'insufficient observations={insufficient}. Do not synthesize missing weather.')
    train(args.bookings,out,args.mode,weather_profile,args.cleaned,args.psa_inflation)
    print('\nNEXT: python mlr-stats.py --design',out/'train_design.csv','--out',out)
    print('DEPLOY: copy',out/'price_model_bundle.joblib','to your backend/model/ folder')

if __name__=='__main__':
    main()
