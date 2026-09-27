import numpy as np

from wavecore.dsp.advanced_ofdm import (
    ResourceGrid,
    ResourceGridConfig,
    allocate_contiguous_ofdma_users,
    grid_to_time_domain,
    raised_cosine_window,
    waveform_to_grid,
)


def test_resource_grid_marks_guards_dc_and_pilots() -> None:
    grid = ResourceGrid(ResourceGridConfig(fft_size=32, symbols=4, left_guard=2, right_guard=3))
    grid.allocate_pilots()
    assert np.all(grid.mask[:, :2] == "guard")
    assert np.all(grid.mask[:, -3:] == "guard")
    assert np.all(grid.mask[:, 16] == "dc")
    assert np.count_nonzero(grid.mask == "pilot") > 0


def test_resource_grid_maps_payload_and_preserves_reserved_bins() -> None:
    grid = ResourceGrid(ResourceGridConfig(fft_size=32, symbols=2, left_guard=2, right_guard=2))
    grid.allocate_pilots()
    remaining = grid.map_data(np.ones(20, dtype=np.complex128))
    assert remaining >= 0
    assert np.all(grid.grid[grid.mask == "guard"] == 0)
    assert np.count_nonzero(grid.mask == "payload") == 20


def test_ofdm_grid_round_trip_without_windowing() -> None:
    rng = np.random.default_rng(1)
    grid = rng.standard_normal((3, 32)) + 1j * rng.standard_normal((3, 32))
    waveform = grid_to_time_domain(grid, cyclic_prefix=8)
    recovered = waveform_to_grid(waveform, fft_size=32, cyclic_prefix=8)
    assert np.allclose(recovered, grid)


def test_raised_cosine_window_has_unit_center_and_tapered_edges() -> None:
    window = raised_cosine_window(16, 4)
    assert window[0] < window[4]
    assert window[-1] < window[-5]
    assert np.allclose(window[4:-4], 1.0)


def test_ofdma_user_allocation_is_disjoint_and_complete() -> None:
    active = np.arange(4, 28)
    allocations = allocate_contiguous_ofdma_users(active, ["ue-1", "ue-2", "ue-3"])
    combined = sorted(value for allocation in allocations for value in allocation.subcarriers)
    assert combined == active.tolist()
    assert len({value for allocation in allocations for value in allocation.subcarriers}) == active.size


def test_resource_grid_maps_multi_user_payloads() -> None:
    grid = ResourceGrid(ResourceGridConfig(fft_size=32, symbols=2, left_guard=2, right_guard=2))
    allocations = allocate_contiguous_ofdma_users(grid.active_subcarriers, ["ue-1", "ue-2"])
    grid.map_ofdma_users(
        {"ue-1": np.ones(5, dtype=np.complex128), "ue-2": -np.ones(5, dtype=np.complex128)},
        allocations,
    )
    assert np.count_nonzero(grid.mask == "user:ue-1") == 5
    assert np.count_nonzero(grid.mask == "user:ue-2") == 5
