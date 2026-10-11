// Power Query (M) for the Olist delivery model.
// ------------------------------------------------------------------
// 1. Create a text parameter named OlistSampleFolder (Home > Manage Parameters)
//    holding the absolute path of projects/olist-delivery-experience/data/sample/
//    including the trailing path separator, for example
//    C:\repos\data-analytics-portfolio\projects\olist-delivery-experience\data\sample\
// 2. Add a blank query named fnLoadCsv and paste the function section.
// 3. Add one blank query per remaining section, named as in its header.
//
// The CSVs are written by `python -m olist_delivery export`. They are
// aggregates (no order, customer, seller or review identifiers, no review
// text) derived from the Olist dataset, CC BY-NC-SA 4.0.
// Status: written against the CSV schema; not yet run in Power BI Desktop.

// ---- OlistSampleFolder (parameter) -------------------------------------------
"C:\path\to\data-analytics-portfolio\projects\olist-delivery-experience\data\sample\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]

// ---- fnLoadCsv ------------------------------------------------------------------
(fileName as text, columnTypes as list) as table =>
let
    Source = Csv.Document(
        File.Contents(OlistSampleFolder & fileName),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Culture fixed to en-US so "." is the decimal separator on any machine.
    Typed = Table.TransformColumnTypes(Promoted, columnTypes, "en-US")
in
    Typed

// ---- fact_route_month -------------------------------------------------------------
// Grain: purchase month x primary seller state x customer state. All orders.
let
    Source = fnLoadCsv(
        "fact_route_month.csv",
        {
            {"month", type text}, {"seller_state", type text}, {"customer_state", type text},
            {"orders", Int64.Type}, {"delivered_orders", Int64.Type}, {"late_orders", Int64.Type},
            {"delivered_missing_date_orders", Int64.Type}, {"days_vs_estimate_sum", Int64.Type},
            {"promised_days_sum", Int64.Type}, {"actual_days_sum", Int64.Type},
            {"reviewed_orders", Int64.Type}, {"review_score_sum", Int64.Type}, {"one_star_reviews", Int64.Type},
            {"late_reviewed_orders", Int64.Type}, {"late_review_score_sum", Int64.Type},
            {"late_one_star_reviews", Int64.Type},
            {"item_revenue", Currency.Type}, {"item_freight", Currency.Type}, {"payment_total", Currency.Type}
        }
    )
in
    Source

// ---- fact_category_month ------------------------------------------------------------
// Grain: purchase month x primary category (category with the most item revenue in the order).
let
    Source = fnLoadCsv(
        "fact_category_month.csv",
        {
            {"month", type text}, {"category", type text}, {"orders", Int64.Type},
            {"delivered_orders", Int64.Type}, {"late_orders", Int64.Type}, {"reviewed_orders", Int64.Type},
            {"review_score_sum", Int64.Type}, {"one_star_reviews", Int64.Type}
        }
    )
in
    Source

// ---- fact_item_revenue_month ----------------------------------------------------------
// Grain: purchase month x item category x whether the order was delivered. Item level.
let
    Source = fnLoadCsv(
        "fact_item_revenue_month.csv",
        {
            {"month", type text}, {"category", type text}, {"is_delivered_order", type logical},
            {"items", Int64.Type}, {"price", Currency.Type}, {"freight", Currency.Type},
            {"item_revenue", Currency.Type}
        }
    )
in
    Source

// ---- fact_delay_review -------------------------------------------------------------------
// Grain: purchase month x delay bucket x review score (blank = no review). Delivered orders only.
let
    Source = fnLoadCsv(
        "fact_delay_review.csv",
        {{"month", type text}, {"delay_bucket", type text}, {"review_score", Int64.Type}, {"orders", Int64.Type}}
    )
in
    Source

// ---- fact_customer_cohort ------------------------------------------------------------------
// Grain: month of a customer's first delivered purchase (customer_unique_id).
let
    Source = fnLoadCsv(
        "fact_customer_cohort.csv",
        {
            {"month", type text}, {"customers", Int64.Type}, {"returned_90d", Int64.Type},
            {"returned_180d", Int64.Type}, {"returned_any", Int64.Type}, {"full_180d_followup", type logical}
        }
    )
in
    Source

// ---- dim_month --------------------------------------------------------------------------------
let
    Source = fnLoadCsv(
        "dim_month.csv",
        {
            {"month", type text}, {"month_start", type date}, {"year", Int64.Type}, {"quarter", Int64.Type},
            {"month_number", Int64.Type}, {"month_name", type text}, {"in_analysis_window", type logical}
        }
    )
in
    Source

// ---- dim_customer_state -------------------------------------------------------------------------
// dim_state.csv loaded twice (role-playing dimension): once for customers, once for sellers.
let
    Source = fnLoadCsv("dim_state.csv", {{"state", type text}, {"state_name", type text}, {"region", type text}}),
    Renamed = Table.RenameColumns(
        Source,
        {{"state", "customer_state"}, {"state_name", "customer_state_name"}, {"region", "customer_region"}}
    )
in
    Renamed

// ---- dim_seller_state -----------------------------------------------------------------------------
let
    Source = fnLoadCsv("dim_state.csv", {{"state", type text}, {"state_name", type text}, {"region", type text}}),
    Renamed = Table.RenameColumns(
        Source,
        {{"state", "seller_state"}, {"state_name", "seller_state_name"}, {"region", "seller_region"}}
    )
in
    Renamed

// ---- dim_category -----------------------------------------------------------------------------------
let
    Source = fnLoadCsv(
        "dim_category.csv",
        {{"category", type text}, {"category_pt", type text}, {"category_source", type text}}
    )
in
    Source

// ---- dim_delay_bucket ----------------------------------------------------------------------------------
let
    Source = fnLoadCsv(
        "dim_delay_bucket.csv",
        {
            {"delay_bucket", type text}, {"label", type text}, {"sort_order", Int64.Type},
            {"lower_days", Int64.Type}, {"upper_days", Int64.Type}, {"is_late", type logical}
        }
    )
in
    Source
