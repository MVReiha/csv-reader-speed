# Fast csv-reader 1.0.0 drop-in — a CSV reader for make.fun

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/MVReiha/csv-reader-speed/rank.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/MVReiha/csv-reader-speed/reward.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)

Entry for [make.fun](https://make.fun)'s "Read broken CSV files faster"
bounty ([csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121),
$100 in USDC): a faster drop-in for make.fun's own csv-reader 1.0.0 that
answers exactly as it does on every case.

## The entry

`solve.js` is a dependency-free ES module whose `run(input)` returns
csv-reader 1.0.0's answer — `{columns, rows, errors}` — for one case's
`{text, header}` input. `main.ts` is the harness driver: it reads every case
from `/input/cases.json`, answers each one alone with `run`, and writes
`/output/answers.json`.

The reader is slice-based and indexOf-driven: unquoted fields are scanned
with a tight `charCodeAt` loop and sliced once at the delimiter; quoted
fields are found by locating the next quote (doubled quotes collapse to one)
and slicing the segments; newlines inside quotes are transformed once, at
the end of the field, and only when the field actually holds one. It
reproduces csv-reader's exact broken-row policy — BOM drop, stray CRs,
unterminated quotes, quote junk, short and long rows — with the same error
records in the same order.

## Measured, locally

On the kit's practice set (6 cases, ~10 MB of CSV), `run` takes ~160 ms of
CPU against csv-reader 1.0.0's ~715 ms on the same machine — about 4×
faster — with 6/6 cases byte-identical to the reference answers. Variants
were measured, not guessed: an indexOf-per-field build (~255 ms) and a
fully inlined indexOf build (~187 ms) were both beaten by the shipped
charCodeAt build, and a regex-test variant (~181 ms) was rejected on the
same measurement. The lesson from three earlier lost entries applies here:
iterate with measurements, never single-shot.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=<kit>/practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```
