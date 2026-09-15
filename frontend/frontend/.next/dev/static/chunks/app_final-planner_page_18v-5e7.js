(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/final-planner/page.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>FinalPlannerPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$TravelContext$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/TravelContext.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const defaultDate = new Date().toISOString().split("T")[0];
const formatDateLabel = (dateString)=>new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        weekday: "long"
    });
const generateDateRange = (startDate, endDate)=>{
    if (!startDate || !endDate || endDate < startDate) return [];
    const days = [];
    const current = new Date(`${startDate}T00:00:00`);
    const last = new Date(`${endDate}T00:00:00`);
    while(current <= last){
        days.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return days;
};
const weatherStyles = {
    Sunny: "border-amber-200 bg-amber-50 text-amber-900",
    Rainy: "border-sky-200 bg-sky-50 text-sky-900",
    Cloudy: "border-slate-200 bg-slate-100 text-slate-800"
};
function FinalPlannerPage() {
    _s();
    const { dateRange, setDateRange, currentActivities, setCurrentActivities, saveItinerary, deleteItinerary, clearCurrentPlan } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$TravelContext$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTravel"])();
    const [startDate, setStartDate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultDate);
    const [endDate, setEndDate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultDate);
    const [mlrPrice, setMlrPrice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("2999");
    const [guests, setGuests] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [activities, setActivities] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [outfit, setOutfit] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [planner, setPlanner] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [savedPlanners, setSavedPlanners] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [errorMessage, setErrorMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FinalPlannerPage.useEffect": ()=>{
            if (dateRange.startDate) setStartDate(dateRange.startDate);
            if (dateRange.endDate) setEndDate(dateRange.endDate);
        }
    }["FinalPlannerPage.useEffect"], [
        dateRange.endDate,
        dateRange.startDate
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FinalPlannerPage.useEffect": ()=>{
            const savedTrip = window.localStorage.getItem("anoTaraTrip");
            try {
                const saved = JSON.parse(window.localStorage.getItem("anoTaraSavedPlanners") || "[]");
                setSavedPlanners(Array.isArray(saved) ? saved : []);
            } catch  {
                window.localStorage.removeItem("anoTaraSavedPlanners");
            }
            if (!savedTrip) return;
            try {
                const trip = JSON.parse(savedTrip);
                const storedDates = Array.isArray(trip.targetDates) ? trip.targetDates : [];
                const savedStartDate = trip.startDate || storedDates[0] || defaultDate;
                const savedEndDate = trip.endDate || storedDates[storedDates.length - 1] || savedStartDate;
                setActivities(Array.isArray(trip.activities) ? trip.activities.map({
                    "FinalPlannerPage.useEffect": (activity)=>({
                            ...activity,
                            guests: Number(activity.guests) || Number(trip.guests) || 1
                        })
                }["FinalPlannerPage.useEffect"]) : []);
                setCurrentActivities(Array.isArray(trip.activities) ? trip.activities : []);
                setStartDate(savedStartDate);
                setEndDate(savedEndDate);
                if (typeof trip.mlrPrice === "number") setMlrPrice(String(trip.mlrPrice));
                if (typeof trip.guests === "number") setGuests(trip.guests);
                setOutfit(trip.outfit || null);
            } catch  {
                window.localStorage.removeItem("anoTaraTrip");
            }
        }
    }["FinalPlannerPage.useEffect"], [
        setCurrentActivities
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FinalPlannerPage.useEffect": ()=>{
            if (currentActivities.length) setActivities(currentActivities);
        }
    }["FinalPlannerPage.useEffect"], [
        currentActivities
    ]);
    const saveTrip = (nextActivities, nextStartDate = startDate, nextEndDate = endDate)=>{
        const current = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
        setDateRange({
            startDate: nextStartDate,
            endDate: nextEndDate
        });
        window.localStorage.setItem("anoTaraTrip", JSON.stringify({
            ...current,
            activities: nextActivities,
            startDate: nextStartDate,
            endDate: nextEndDate,
            targetDates: generateDateRange(nextStartDate, nextEndDate),
            guests: Number(guests) || 1,
            mlrPrice: Number(mlrPrice) || 0
        }));
    };
    const removeActivity = (index)=>{
        const nextActivities = activities.filter((_, activityIndex)=>activityIndex !== index);
        setActivities(nextActivities);
        saveTrip(nextActivities);
        setPlanner(null);
        setCurrentActivities(nextActivities);
    };
    const removeOutfit = ()=>{
        setOutfit(null);
        const current = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
        delete current.outfit;
        window.localStorage.setItem("anoTaraTrip", JSON.stringify(current));
        if (planner) {
            setPlanner((prev)=>prev ? {
                    ...prev,
                    outfit: null
                } : null);
        }
    };
    const changeActivityGuests = (index, change)=>{
        const nextActivities = activities.map((activity, activityIndex)=>activityIndex === index ? {
                ...activity,
                guests: Math.max(1, (Number(activity.guests) || 1) + change)
            } : activity);
        setActivities(nextActivities);
        saveTrip(nextActivities);
        setPlanner(null);
        setCurrentActivities(nextActivities);
    };
    const changeActivityDay = (index, assignedDay)=>{
        const nextActivities = activities.map((activity, activityIndex)=>activityIndex === index ? {
                ...activity,
                assignedDay
            } : activity);
        setActivities(nextActivities);
        saveTrip(nextActivities);
        setCurrentActivities(nextActivities);
        setPlanner(null);
    };
    const printAndSavePlanner = ()=>{
        if (!planner) return;
        const saved = [
            planner,
            ...savedPlanners
        ];
        saveItinerary(planner);
        window.localStorage.setItem("anoTaraSavedPlanners", JSON.stringify(saved));
        setSavedPlanners(saved);
        setActivities([]);
        window.localStorage.setItem("anoTaraTrip", JSON.stringify({
            startDate,
            endDate,
            targetDates: generateDateRange(startDate, endDate),
            guests,
            activities: [],
            mlrPrice: Number(mlrPrice) || 0
        }));
        setCurrentActivities([]);
        window.print();
    };
    const deleteCurrentItinerary = ()=>{
        if (!planner) return;
        deleteItinerary(planner.createdAt);
        setSavedPlanners((current)=>current.filter((item)=>item.createdAt !== planner.createdAt));
        setPlanner(null);
    };
    const handleClearCurrentPlan = ()=>{
        clearCurrentPlan();
        setActivities([]);
        setPlanner(null);
        setStartDate("");
        setEndDate("");
    };
    const generatePlanner = async (event)=>{
        event.preventDefault();
        setErrorMessage("");
        const targetDates = generateDateRange(startDate, endDate);
        if (!startDate || !endDate || endDate < startDate || !targetDates.length) {
            setErrorMessage("Choose a valid start and end date.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch("http://localhost:8000/api/generate-itinerary", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    target_dates: targetDates,
                    raw_activities: activities.map((activity)=>({
                            ...activity,
                            assigned_day: activity.assignedDay
                        })),
                    mlr_price: Number(mlrPrice),
                    guests: Number(guests),
                    outfit: outfit || undefined
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");
            }
            if (!data?.itinerary || !data?.total_estimated_price || !data?.destination_totals) {
                throw new Error("The backend returned an incomplete planner response. Restart the backend and try again.");
            }
            const newPlanner = {
                ...data,
                outfit,
                createdAt: new Date().toLocaleString()
            };
            setPlanner(newPlanner);
        } catch (error) {
            setErrorMessage(error?.message || "Could not connect to the backend.");
        } finally{
            setIsLoading(false);
        }
    };
    const itineraryDays = (planner?.itinerary || []).map((day, dayIndex)=>({
            dayNumber: `Day ${dayIndex + 1}`,
            date: formatDateLabel(day.date || day.day),
            activities: (day.scheduled_activities || []).map((activity)=>({
                    ...activity,
                    location: activity.location || activity.destination,
                    apparel: activity.apparel || day.outfit_advice,
                    price: Number(activity.price ?? ((activity.price_range?.min || 0) + (activity.price_range?.max || 0)) / 2),
                    image: activity.image,
                    hasLongTravelWarning: Boolean(activity.hasLongTravelWarning)
                }))
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "planner-shell min-h-screen bg-[#f5f7fa] px-4 py-5 text-slate-900 sm:px-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-6xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "planner-controls",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/",
                                    className: "text-sm font-semibold text-slate-500 hover:text-slate-900",
                                    children: "Back to home"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 210,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "mt-3 text-4xl font-black tracking-tight sm:text-6xl",
                                    children: "Final planner"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 213,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-2 max-w-2xl text-base text-slate-600",
                                    children: "A print-ready trip plan arranged by forecast, activity type, and estimated cost."
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 214,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 209,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "planner-controls flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: handleClearCurrentPlan,
                                    className: "rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50",
                                    children: "Clear current plan"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 217,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    disabled: !planner,
                                    onClick: printAndSavePlanner,
                                    className: "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                                    children: "Print planner"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 220,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white",
                                    children: "Decision Tree"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 223,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 216,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/final-planner/page.js",
                    lineNumber: 208,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                            onSubmit: generatePlanner,
                            className: "planner-controls rounded-2xl bg-white p-5 shadow-sm sm:p-7",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-xl font-bold",
                                    children: "Selected trip details"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 229,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-6 grid gap-3 sm:grid-cols-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-sm font-semibold text-slate-700",
                                            children: [
                                                "Start date",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "date",
                                                    value: startDate,
                                                    onChange: (event)=>{
                                                        const nextStartDate = event.target.value;
                                                        const nextEndDate = endDate < nextStartDate ? nextStartDate : endDate;
                                                        setStartDate(nextStartDate);
                                                        setEndDate(nextEndDate);
                                                        saveTrip(activities, nextStartDate, nextEndDate);
                                                        setPlanner(null);
                                                    },
                                                    className: "mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 233,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 231,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-sm font-semibold text-slate-700",
                                            children: [
                                                "End date",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "date",
                                                    min: startDate,
                                                    value: endDate,
                                                    onChange: (event)=>{
                                                        setEndDate(event.target.value);
                                                        saveTrip(activities, startDate, event.target.value);
                                                        setPlanner(null);
                                                    },
                                                    className: "mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 242,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 240,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 230,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-6 border-t border-slate-200 pt-5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-sm font-bold uppercase tracking-wider text-slate-500",
                                                    children: "Clicked activities"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 254,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/destinations",
                                                    className: "text-sm font-bold text-slate-700 hover:underline",
                                                    children: "Choose more"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 255,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 253,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-4 text-sm text-slate-500",
                                            children: "Set guests per activity below. Estimates use each activity's guest count."
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 257,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 space-y-2",
                                            children: activities.map((activity, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded-xl bg-slate-50 px-3 py-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center justify-between gap-3",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "min-w-0 truncate text-sm font-medium",
                                                                    children: activity.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 262,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    type: "button",
                                                                    onClick: ()=>removeActivity(index),
                                                                    className: "shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50",
                                                                    "aria-label": `Remove ${activity.name}`,
                                                                    children: "Remove"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 263,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 261,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "mt-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-slate-500",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: [
                                                                        activity.type,
                                                                        " · ",
                                                                        activity.destination
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 266,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "flex items-center gap-2 normal-case text-slate-700",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>changeActivityGuests(index, -1),
                                                                            className: "flex h-6 w-6 items-center justify-center rounded-full border border-slate-300",
                                                                            children: "−"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                            lineNumber: 267,
                                                                            columnNumber: 92
                                                                        }, this),
                                                                        activity.guests,
                                                                        " guest",
                                                                        activity.guests === 1 ? "" : "s",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            type: "button",
                                                                            onClick: ()=>changeActivityGuests(index, 1),
                                                                            className: "flex h-6 w-6 items-center justify-center rounded-full border border-slate-300",
                                                                            children: "+"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                            lineNumber: 267,
                                                                            columnNumber: 319
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 267,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 265,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "Assign to"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 270,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                    value: activity.assignedDay || "Day 1",
                                                                    onChange: (event)=>changeActivityDay(index, event.target.value),
                                                                    className: "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-slate-900",
                                                                    children: generateDateRange(startDate, endDate).map((date, dayIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                            value: `Day ${dayIndex + 1}`,
                                                                            children: [
                                                                                "Day ",
                                                                                dayIndex + 1,
                                                                                " · ",
                                                                                formatDateLabel(date)
                                                                            ]
                                                                        }, date, true, {
                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                            lineNumber: 277,
                                                                            columnNumber: 27
                                                                        }, this))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 271,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 269,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, `${activity.name}-${activity.destination}-${index}`, true, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 260,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 258,
                                            columnNumber: 15
                                        }, this),
                                        !activities.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500",
                                            children: "Choose activities from a destination page first."
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 284,
                                            columnNumber: 37
                                        }, this) : null,
                                        outfit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-slate-900 shadow-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-start justify-between gap-3",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-3",
                                                        children: [
                                                            outfit.image ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                src: outfit.image,
                                                                alt: "Attached outfit",
                                                                className: "h-14 w-14 rounded-xl object-cover border border-emerald-300 bg-white shadow-sm"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 292,
                                                                columnNumber: 25
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-200 text-2xl",
                                                                children: "👗"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 294,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-2",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-xs font-bold uppercase tracking-wider text-emerald-800",
                                                                                children: "Attached Outfit"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 298,
                                                                                columnNumber: 27
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: `rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${outfit.matches ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"}`,
                                                                                children: outfit.matches ? "Weather Match" : "Needs adjustment"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 299,
                                                                                columnNumber: 27
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 297,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-0.5 text-sm font-bold text-slate-900",
                                                                        children: outfit.category || "Selected Outfit"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 305,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-xs text-slate-600",
                                                                        children: [
                                                                            outfit.destination || "Trip",
                                                                            " · ",
                                                                            outfit.weather,
                                                                            " weather"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 306,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 296,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 290,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 289,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-2.5 text-xs text-slate-600 leading-relaxed",
                                                    children: outfit.advice
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 311,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mt-3 flex items-center justify-between border-t border-emerald-200/60 pt-2.5 text-xs",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                            href: "/predict-outfit",
                                                            className: "font-bold text-emerald-800 hover:underline",
                                                            children: "Change / Try another outfit"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 314,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: removeOutfit,
                                                            className: "font-bold text-rose-600 hover:text-rose-800 hover:underline",
                                                            children: "Remove outfit"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 317,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 313,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 288,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between gap-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-2 text-xs font-semibold text-slate-700",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-base",
                                                                    children: "👗"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 330,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: "No outfit attached yet"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 331,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 329,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                            href: "/predict-outfit",
                                                            className: "rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 transition",
                                                            children: "Predict outfit"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/final-planner/page.js",
                                                            lineNumber: 333,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 328,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-1.5 text-[11px] text-slate-500",
                                                    children: "Test if your clothing matches your destination's predicted weather before finalizing."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 340,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 327,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 252,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "submit",
                                    disabled: isLoading || !activities.length,
                                    className: "mt-7 w-full rounded-xl bg-[#b9f0c8] px-4 py-3 text-base font-black text-slate-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60",
                                    children: isLoading ? "Arranging your trip..." : "Generate final planner"
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 347,
                                    columnNumber: 13
                                }, this),
                                errorMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700",
                                    children: errorMessage
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 350,
                                    columnNumber: 29
                                }, this) : null
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 228,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            "aria-live": "polite",
                            className: "planner-document",
                            children: [
                                !planner && !isLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-lg font-semibold text-slate-700",
                                            children: "Your final planner will appear here."
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 356,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-sm",
                                            children: "Generate a plan to see each day, its mock weather, activities, and outfit advice."
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 357,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 355,
                                    columnNumber: 15
                                }, this) : null,
                                isLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl bg-white p-8 text-center text-slate-500",
                                    children: "The Decision Tree is arranging your activities..."
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 361,
                                    columnNumber: 26
                                }, this) : null,
                                planner ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "w-full min-h-screen bg-[url('/plannerbg.jpg')] bg-cover bg-center bg-no-repeat py-12",
                                    style: {
                                        WebkitPrintColorAdjust: 'exact',
                                        printColorAdjust: 'exact'
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "max-w-5xl mx-auto px-6 md:px-12 flex flex-col gap-10",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex justify-end",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: deleteCurrentItinerary,
                                                    disabled: !planner,
                                                    className: "rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50",
                                                    children: "Delete itinerary"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/final-planner/page.js",
                                                    lineNumber: 370,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/final-planner/page.js",
                                                lineNumber: 369,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col md:flex-row gap-6",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "relative flex-1 bg-[#F9F7F4] rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "w-[60%]",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                        className: "text-sm font-bold text-gray-500 uppercase tracking-widest",
                                                                        children: "Trip Outfit Match"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 379,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                        className: "text-2xl font-extrabold text-[#1E3A8A] mb-2",
                                                                        children: (planner.outfit || outfit)?.category || "Recommended Outfit"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 380,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-sm text-gray-700",
                                                                        children: (planner.outfit || outfit)?.advice || planner.itinerary[0]?.outfit_advice || "Comfortable and weather-appropriate casual travel attire."
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 383,
                                                                        columnNumber: 23
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 378,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute right-4 w-28 h-28 bg-white p-2 shadow-lg rotate-3 z-10 border border-gray-200",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                    src: (planner.outfit || outfit)?.image || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80",
                                                                    alt: "Outfit",
                                                                    className: "w-full h-full object-cover"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                    lineNumber: 389,
                                                                    columnNumber: 23
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 388,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 377,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex-1 bg-[#F9F7F4] rounded-2xl p-6 shadow-sm border border-gray-100",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                className: "text-sm font-bold text-gray-500 uppercase tracking-widest mb-4",
                                                                children: "Estimated Price"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 399,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex flex-col gap-3 text-sm text-gray-800 font-medium",
                                                                children: [
                                                                    planner.destination_totals && Object.keys(planner.destination_totals).length > 0 ? Object.entries(planner.destination_totals).map(([destination, range])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "flex justify-between border-b border-gray-200 pb-2",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: destination
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                                    lineNumber: 404,
                                                                                    columnNumber: 29
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: [
                                                                                        "PHP ",
                                                                                        Number(range.min).toLocaleString(),
                                                                                        "–",
                                                                                        Number(range.max).toLocaleString()
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/app/final-planner/page.js",
                                                                                    lineNumber: 405,
                                                                                    columnNumber: 29
                                                                                }, this)
                                                                            ]
                                                                        }, destination, true, {
                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                            lineNumber: 403,
                                                                            columnNumber: 27
                                                                        }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex justify-between border-b border-gray-200 pb-2",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "Total Estimate"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 410,
                                                                                columnNumber: 27
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: [
                                                                                    "PHP ",
                                                                                    Number(planner.total_estimated_price?.min || 0).toLocaleString(),
                                                                                    "–",
                                                                                    Number(planner.total_estimated_price?.max || 0).toLocaleString()
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 411,
                                                                                columnNumber: 27
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 409,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex justify-between pt-1 font-bold text-[#1E3A8A]",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: "Baseline MLR"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 415,
                                                                                columnNumber: 25
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: [
                                                                                    "PHP ",
                                                                                    Number(planner.final_mlr_price || 0).toLocaleString()
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 416,
                                                                                columnNumber: 25
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 414,
                                                                        columnNumber: 23
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 400,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 398,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/final-planner/page.js",
                                                lineNumber: 375,
                                                columnNumber: 17
                                            }, this),
                                            planner.itinerary[0] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between gap-2 border-b border-slate-200 pb-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-xs font-bold uppercase tracking-wider text-slate-700",
                                                                children: [
                                                                    "Forecast & Historical Climate Comparison · ",
                                                                    planner.itinerary[0].destination
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 425,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] font-semibold text-slate-500",
                                                                children: "Open-Meteo Priority"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 428,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 424,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "mt-3 grid gap-3 sm:grid-cols-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-xl border border-emerald-200 bg-emerald-50/50 p-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-[11px] font-bold uppercase text-emerald-900",
                                                                        children: "Current Forecast"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 432,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-2 text-sm font-bold text-slate-900",
                                                                        children: [
                                                                            planner.itinerary[0].expected_weather,
                                                                            " · ",
                                                                            planner.itinerary[0].weather_forecast?.temperature_min_c ?? 24,
                                                                            "°C – ",
                                                                            planner.itinerary[0].weather_forecast?.temperature_max_c ?? 31,
                                                                            "°C"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 433,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-1 text-xs text-slate-700",
                                                                        children: [
                                                                            "Rainfall: ",
                                                                            planner.itinerary[0].weather_forecast?.precipitation_sum_mm ?? 0,
                                                                            " mm"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 436,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 431,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "rounded-xl border border-blue-200 bg-blue-50/50 p-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-[11px] font-bold uppercase text-blue-900",
                                                                        children: "Historical Climate"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 439,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-2 text-sm font-bold text-slate-900",
                                                                        children: [
                                                                            planner.itinerary[0].historical_weather?.dominant_condition || "Cloudy",
                                                                            " · Avg ",
                                                                            planner.itinerary[0].historical_weather?.average_temperature_c ?? 27.5,
                                                                            "°C"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 440,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-1 text-xs text-slate-700",
                                                                        children: [
                                                                            "Average rainfall: ",
                                                                            planner.itinerary[0].historical_weather?.average_rainfall_mm ?? 5,
                                                                            " mm"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 443,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 438,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 430,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/final-planner/page.js",
                                                lineNumber: 423,
                                                columnNumber: 19
                                            }, this) : null,
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "w-full max-w-5xl mx-auto mt-8 p-8 md:p-12 rounded-3xl shadow-2xl relative bg-[url('/plannerbg.png')] bg-cover bg-center bg-no-repeat",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "absolute inset-0 bg-white/40 rounded-3xl z-0 pointer-events-none"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 450,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "relative z-10",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                className: "text-3xl font-serif font-extrabold text-[#D93845] mb-10 text-center italic",
                                                                children: "Itinerary Overview"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 452,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex flex-col gap-10",
                                                                children: itineraryDays.map((day)=>{
                                                                    const dailySpend = day.activities.reduce((total, activity)=>total + Number(activity.price || 0), 0);
                                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                                                        className: "border-b border-white/70 pb-8 last:border-b-0",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                                                                                className: "mb-5 text-center",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                        className: "text-2xl font-serif font-bold text-[#1E3A8A]",
                                                                                        children: day.dayNumber
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                        lineNumber: 463,
                                                                                        columnNumber: 31
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                        className: "mt-1 text-sm font-semibold uppercase tracking-widest text-gray-500",
                                                                                        children: day.date
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                        lineNumber: 464,
                                                                                        columnNumber: 31
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 462,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "flex flex-col gap-4",
                                                                                children: day.activities.map((activity, activityIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "mb-4",
                                                                                        children: [
                                                                                            activity.hasLongTravelWarning ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                className: "mb-2 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800",
                                                                                                children: [
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                                                                        className: "h-4 w-4 shrink-0",
                                                                                                        viewBox: "0 0 24 24",
                                                                                                        fill: "none",
                                                                                                        stroke: "currentColor",
                                                                                                        strokeWidth: "2",
                                                                                                        "aria-hidden": "true",
                                                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                                                                            strokeLinecap: "round",
                                                                                                            strokeLinejoin: "round",
                                                                                                            d: "M12 9v3.75m0 3.75h.008M10.29 3.86 2.82 17.25A1.5 1.5 0 0 0 4.12 19.5h15.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.96 1.96 0 0 0-3.42 0Z"
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                                                            lineNumber: 473,
                                                                                                            columnNumber: 41
                                                                                                        }, this)
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                        lineNumber: 472,
                                                                                                        columnNumber: 39
                                                                                                    }, this),
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                        children: "Long travel distance from the previous location."
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                        lineNumber: 475,
                                                                                                        columnNumber: 39
                                                                                                    }, this)
                                                                                                ]
                                                                                            }, void 0, true, {
                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                lineNumber: 471,
                                                                                                columnNumber: 37
                                                                                            }, this) : null,
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                className: "relative flex items-center w-full",
                                                                                                children: [
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                        className: "w-[85%] bg-[#FDFBF7] p-6 pr-24 shadow-md border border-gray-200 rounded-xl z-0",
                                                                                                        children: [
                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                                                                className: "text-xl font-extrabold text-[#1E3A8A] uppercase tracking-wide",
                                                                                                                children: activity.name
                                                                                                            }, void 0, false, {
                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                lineNumber: 481,
                                                                                                                columnNumber: 39
                                                                                                            }, this),
                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                                className: "mt-2 text-sm font-medium text-gray-700",
                                                                                                                children: [
                                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                        className: "text-xs font-bold text-gray-400 uppercase tracking-wider",
                                                                                                                        children: "LOCATION:"
                                                                                                                    }, void 0, false, {
                                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                                        lineNumber: 486,
                                                                                                                        columnNumber: 41
                                                                                                                    }, this),
                                                                                                                    " ",
                                                                                                                    activity.location || "Destination"
                                                                                                                ]
                                                                                                            }, void 0, true, {
                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                lineNumber: 485,
                                                                                                                columnNumber: 39
                                                                                                            }, this),
                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                                className: "mt-5 flex flex-col gap-2 border-t border-gray-200 pt-4",
                                                                                                                children: [
                                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                                        className: "text-sm text-gray-600",
                                                                                                                        children: [
                                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                                className: "text-xs font-bold text-gray-400 uppercase tracking-wider",
                                                                                                                                children: "FORECAST:"
                                                                                                                            }, void 0, false, {
                                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                                lineNumber: 492,
                                                                                                                                columnNumber: 43
                                                                                                                            }, this),
                                                                                                                            " ",
                                                                                                                            activity.weather || "Clear / Mild"
                                                                                                                        ]
                                                                                                                    }, void 0, true, {
                                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                                        lineNumber: 491,
                                                                                                                        columnNumber: 41
                                                                                                                    }, this),
                                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                                        className: "text-sm text-gray-600",
                                                                                                                        children: [
                                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                                className: "text-xs font-bold text-gray-400 uppercase tracking-wider",
                                                                                                                                children: "APPAREL:"
                                                                                                                            }, void 0, false, {
                                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                                lineNumber: 496,
                                                                                                                                columnNumber: 43
                                                                                                                            }, this),
                                                                                                                            " ",
                                                                                                                            activity.apparel || "Comfortable travel attire"
                                                                                                                        ]
                                                                                                                    }, void 0, true, {
                                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                                        lineNumber: 495,
                                                                                                                        columnNumber: 41
                                                                                                                    }, this),
                                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                                        className: "text-sm text-gray-600",
                                                                                                                        children: [
                                                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                                                className: "text-xs font-bold text-gray-400 uppercase tracking-wider",
                                                                                                                                children: "ESTIMATE:"
                                                                                                                            }, void 0, false, {
                                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                                lineNumber: 500,
                                                                                                                                columnNumber: 43
                                                                                                                            }, this),
                                                                                                                            " ",
                                                                                                                            "PHP ",
                                                                                                                            Number(activity.price || 0).toLocaleString()
                                                                                                                        ]
                                                                                                                    }, void 0, true, {
                                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                                        lineNumber: 499,
                                                                                                                        columnNumber: 41
                                                                                                                    }, this)
                                                                                                                ]
                                                                                                            }, void 0, true, {
                                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                                lineNumber: 490,
                                                                                                                columnNumber: 39
                                                                                                            }, this)
                                                                                                        ]
                                                                                                    }, void 0, true, {
                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                        lineNumber: 480,
                                                                                                        columnNumber: 37
                                                                                                    }, this),
                                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                                        className: "absolute right-0 w-40 h-40 bg-gray-200 border-[6px] border-white shadow-xl rotate-3 rounded-sm z-10 overflow-hidden transition-transform duration-300 hover:rotate-0 hover:scale-105",
                                                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                                                                            src: activity.image || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80",
                                                                                                            alt: activity.name || "Destination",
                                                                                                            className: "h-full w-full object-cover"
                                                                                                        }, void 0, false, {
                                                                                                            fileName: "[project]/app/final-planner/page.js",
                                                                                                            lineNumber: 507,
                                                                                                            columnNumber: 39
                                                                                                        }, this)
                                                                                                    }, void 0, false, {
                                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                                        lineNumber: 506,
                                                                                                        columnNumber: 37
                                                                                                    }, this)
                                                                                                ]
                                                                                            }, void 0, true, {
                                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                                lineNumber: 479,
                                                                                                columnNumber: 35
                                                                                            }, this)
                                                                                        ]
                                                                                    }, activity.id || `${day.dayNumber}-${activity.name}-${activityIndex}`, true, {
                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                        lineNumber: 469,
                                                                                        columnNumber: 33
                                                                                    }, this))
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 467,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "mt-5 flex items-center justify-between border-t border-white/80 pt-3 text-sm font-bold text-[#1E3A8A]",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        children: "Average Daily Spend"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                        lineNumber: 519,
                                                                                        columnNumber: 31
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        children: [
                                                                                            "PHP ",
                                                                                            dailySpend.toLocaleString()
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                                        lineNumber: 520,
                                                                                        columnNumber: 31
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/app/final-planner/page.js",
                                                                                lineNumber: 518,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, day.dayNumber, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 461,
                                                                        columnNumber: 27
                                                                    }, this);
                                                                })
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 456,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "mt-8 rounded-2xl bg-[#1E3A8A] px-6 py-5 text-center text-white shadow-lg",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-xs font-bold uppercase tracking-[0.2em] text-white/70",
                                                                        children: "Total Estimated Trip Cost"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 528,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-2 text-3xl font-black",
                                                                        children: [
                                                                            "PHP ",
                                                                            itineraryDays.reduce((total, day)=>total + day.activities.reduce((dailyTotal, activity)=>dailyTotal + Number(activity.price || 0), 0), 0).toLocaleString()
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/final-planner/page.js",
                                                                        lineNumber: 529,
                                                                        columnNumber: 23
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/final-planner/page.js",
                                                                lineNumber: 527,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/final-planner/page.js",
                                                        lineNumber: 451,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/final-planner/page.js",
                                                lineNumber: 449,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/final-planner/page.js",
                                        lineNumber: 368,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 364,
                                    columnNumber: 15
                                }, this) : null
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 353,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/final-planner/page.js",
                    lineNumber: 227,
                    columnNumber: 9
                }, this),
                savedPlanners.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "planner-controls mt-10 border-t border-slate-200 pt-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-lg font-black",
                            children: "Saved planners"
                        }, void 0, false, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 542,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 flex flex-wrap gap-2",
                            children: savedPlanners.map((savedPlanner, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setPlanner(savedPlanner),
                                    className: `rounded-xl border px-3 py-2 text-left text-sm ${savedPlanner === planner ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`,
                                    children: [
                                        "Planner ",
                                        savedPlanners.length - index,
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "ml-2 text-xs opacity-70",
                                            children: savedPlanner.itinerary[0]?.day
                                        }, void 0, false, {
                                            fileName: "[project]/app/final-planner/page.js",
                                            lineNumber: 546,
                                            columnNumber: 57
                                        }, this)
                                    ]
                                }, savedPlanner.createdAt, true, {
                                    fileName: "[project]/app/final-planner/page.js",
                                    lineNumber: 545,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/app/final-planner/page.js",
                            lineNumber: 543,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/final-planner/page.js",
                    lineNumber: 541,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/app/final-planner/page.js",
            lineNumber: 207,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/final-planner/page.js",
        lineNumber: 206,
        columnNumber: 5
    }, this);
}
_s(FinalPlannerPage, "YTj2NhZaS4c++yiauribQU6qbHg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$TravelContext$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTravel"]
    ];
});
_c = FinalPlannerPage;
var _c;
__turbopack_context__.k.register(_c, "FinalPlannerPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_final-planner_page_18v-5e7.js.map