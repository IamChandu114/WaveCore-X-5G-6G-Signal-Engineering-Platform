# Advanced OFDM Engine

## Architecture

The advanced OFDM engine models the frequency-time resource grid as a first-class backend object. It separates reserved subcarriers, pilots, payload data, and OFDMA user allocations before converting the grid to a time-domain waveform.

Core module: `wavecore.dsp.advanced_ofdm`

## Mathematics

For each OFDM symbol, frequency-domain bins `X[k]` are converted to time-domain samples:

```text
x[n] = (1/N) sum_k X[k] exp(j 2 pi k n / N)
```

A cyclic prefix copies the last `N_cp` samples to the front of each symbol to reduce inter-symbol interference under multipath delay spread. Guard bands reserve edge subcarriers to limit adjacent-channel emissions. The DC bin can be nulled to avoid direct-conversion receiver impairments.

Windowing applies a raised-cosine taper to symbol edges to reduce spectral leakage:

```text
x_w[n] = x[n] w[n]
```

OFDMA assigns disjoint subcarrier groups to users, allowing multiple devices to share the same OFDM symbol period.

## Implementation

- `ResourceGridConfig`: FFT size, OFDM symbols, cyclic prefix, pilot spacing, guard bands, DC null.
- `ResourceGrid`: mutable complex grid plus semantic mask for `guard`, `dc`, `pilot`, `payload`, and `user:<id>`.
- `grid_to_time_domain`: IFFT, cyclic prefix, optional windowing.
- `waveform_to_grid`: cyclic-prefix removal and FFT.
- `allocate_contiguous_ofdma_users`: deterministic contiguous subcarrier allocation.

## Industrial Usage

This mirrors LTE/5G/Wi-Fi physical resource mapping. Production systems use richer numerology, slot formats, MIMO layers, reference-signal patterns, and scheduler-controlled allocations. This module gives the backend a real resource-grid model that frontend visualizations can consume later without inventing chart data.
