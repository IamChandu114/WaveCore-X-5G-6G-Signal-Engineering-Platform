# Wireless Channel Engine

## Architecture

The advanced channel engine lives in `wavecore.dsp.advanced_channel` and complements the Milestone 1 AWGN/Rayleigh/Rician channel. It models deterministic and statistical propagation effects as composable functions.

## Mathematics

Multipath applies a tapped-delay-line channel:

```text
y[n] = sum_l h_l[n] x[n - d_l]
```

Each tap has delay, gain, phase, and optional Doppler rotation:

```text
h_l[n] = a_l exp(j phi_l) exp(j 2 pi f_D,l n / Fs)
```

Log-distance path loss:

```text
PL(d) = PL(d0) + 10 n log10(d / d0)
```

RMS delay spread:

```text
sigma_tau = sqrt(E[tau^2] - E[tau]^2)
```

Coherence bandwidth is estimated as `1 / (5 sigma_tau)` for roughly 0.5 correlation.

## Industrial Usage

These models are used to evaluate OFDM cyclic-prefix sufficiency, equalizer robustness, link budgets, and mobility sensitivity. Qualcomm-class modem work uses more detailed 3GPP tapped-delay-line and clustered-delay-line models, but this module gives the platform a physically meaningful channel-analysis core.
