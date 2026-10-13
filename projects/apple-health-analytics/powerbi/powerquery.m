// Power Query (M) for the rebuilt model. Create a text parameter `SampleFolder`
// pointing at the absolute path of projects/apple-health-analytics/data/model/
// (daily values only), then add one blank query per section below.
// Never point SampleFolder at a raw Apple Health export.

// ---- fact_daily_metric -------------------------------------------------------
let
    Source = Csv.Document(
        File.Contents(SampleFolder & "fact_daily_metric.csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Typed = Table.TransformColumnTypes(
        Promoted,
        {{"date", type date}, {"metric", type text}, {"value", type number}},
        "en-US"
    )
in
    Typed

// ---- dim_metric ----------------------------------------------------------------
let
    Source = Csv.Document(
        File.Contents(SampleFolder & "dim_metric.csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Typed = Table.TransformColumnTypes(
        Promoted,
        {
            {"metric", type text}, {"label", type text}, {"group", type text},
            {"unit", type text}, {"kind", type text},
            {"plausible_min", type number}, {"plausible_max", type number}
        }
    )
in
    Typed

// ---- dim_date ------------------------------------------------------------------
let
    Source = Csv.Document(
        File.Contents(SampleFolder & "dim_date.csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Typed = Table.TransformColumnTypes(
        Promoted,
        {
            {"date", type date}, {"year", Int64.Type}, {"quarter", Int64.Type},
            {"month", Int64.Type}, {"month_name", type text},
            {"week_start", type date}, {"day_of_week", Int64.Type}, {"day_name", type text},
            {"is_weekend", type logical}
        },
        "en-US"
    )
in
    Typed
