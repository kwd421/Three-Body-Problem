# Exploratory comparisons

Run `python research/experiments/prepare.py`, then `node research/experiments/compare.js` and optionally `node research/experiments/tune.js` (about a minute on the original container).

observed_*.jsonl records actual local runs before publishing. Millisecond values are one-machine observations, not performance guarantees. Weighted exploratory variants include successful-step reuse; the selected production p20/h=1/512 run has no rejected steps, so that scheduling variation does not affect its trajectory enclosure. These scripts are not scheduled by CI. Failed configurations are preserved, not relabeled as collisions or missing solutions.
