import argparse
from pathlib import Path
import pandas as pd
import numpy as np
import statsmodels.api as sm


def run(design_csv,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    df=pd.read_csv(design_csv)
    y=df.pop('target_log_multiplier')
    X=sm.add_constant(df,has_constant='add').astype(float)
    groups_file=Path(design_csv).with_name('train_groups.csv')
    n_clusters=0
    if groups_file.exists():
        grp=pd.read_csv(groups_file)['arrival_year_month']
        if len(grp)!=len(df):raise ValueError('train_groups.csv must align row-for-row with train_design.csv')
        n_clusters=grp.nunique()
    else:
        grp=None
    fit=sm.OLS(y,X).fit(cov_type='cluster',cov_kwds={'groups':grp}) if grp is not None and n_clusters>=10 else sm.OLS(y,X).fit(cov_type='HC3')
    tbl=pd.DataFrame({'feature':fit.params.index,'coefficient_log_scale':fit.params.values,
                      'robust_std_error':fit.bse.values,'t_statistic':fit.tvalues.values,
                      'p_value':fit.pvalues.values,'ci95_low':fit.conf_int().iloc[:,0].values,
                      'ci95_high':fit.conf_int().iloc[:,1].values})
    tbl.to_csv(out/'ols_coefficients.csv',index=False)
    (out/'ols_summary.txt').write_text(fit.summary().as_text(),encoding='utf-8')
    meta=f'OLS regression on TRAIN partition ONLY; n={len(df)}; variables={len(df.columns)}; design rank={np.linalg.matrix_rank(X.to_numpy())}; full X columns={X.shape[1]}; R2={fit.rsquared:.5f}.\n'
    meta+=f'SE method={fit.cov_type}; arrival-year-month clusters={n_clusters}. Month-fixed inflation values repeat across bookings; row-wise p-values can overstate evidence if not clustered.\n'
    meta+='The source-domain OLS p-values are associations, not causation or proof of Philippine validity. Standard error method is reported above.\n'
    meta+='Calendar-mode month indicators are NOT included together with PH month-fixed weather.\n'
    meta+='PSA all-items inflation is a cross-domain historical macro proxy, not Portuguese inflation or a causal PH hotel price effect.\n'
    meta+='Check inflation_ablation.csv and the rank/condition number before claiming added predictive value.\n'
    (out/'ols_interpretation_notes.txt').write_text(meta,encoding='utf-8')
    print(meta);print(tbl.to_string(index=False,max_rows=40));return fit

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--design',default='output/calendar/train_design.csv')
    p.add_argument('--out',default='output/calendar');a=p.parse_args();run(a.design,a.out)
