from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations, product

import numpy as np


def _bits(values: np.ndarray) -> np.ndarray:
    return np.asarray(values, dtype=np.uint8) & 1


@dataclass(frozen=True)
class ConvolutionalCode:
    constraint_length: int = 7
    generators: tuple[int, ...] = (0o133, 0o171)

    @property
    def memory(self) -> int:
        return self.constraint_length - 1

    @property
    def states(self) -> int:
        return 1 << self.memory

    def encode(self, bits: np.ndarray, terminate: bool = True) -> np.ndarray:
        payload = _bits(bits)
        if terminate:
            payload = np.concatenate([payload, np.zeros(self.memory, dtype=np.uint8)])
        shift = 0
        encoded: list[int] = []
        mask = (1 << self.constraint_length) - 1
        for bit in payload:
            shift = ((shift << 1) | int(bit)) & mask
            for generator in self.generators:
                encoded.append((shift & generator).bit_count() & 1)
        return np.asarray(encoded, dtype=np.uint8)

    def viterbi_decode(self, received_bits: np.ndarray, traceback: int | None = None) -> np.ndarray:
        received = _bits(received_bits)
        outputs_per_input = len(self.generators)
        if received.size % outputs_per_input:
            raise ValueError("received bit count must align with code rate")
        steps = received.size // outputs_per_input
        inf = 1_000_000
        metrics = np.full(self.states, inf, dtype=np.int32)
        metrics[0] = 0
        predecessors = np.zeros((steps, self.states), dtype=np.int16)
        decisions = np.zeros((steps, self.states), dtype=np.uint8)

        for step in range(steps):
            next_metrics = np.full(self.states, inf, dtype=np.int32)
            symbol = received[step * outputs_per_input : (step + 1) * outputs_per_input]
            for state in range(self.states):
                if metrics[state] >= inf:
                    continue
                for bit in (0, 1):
                    next_state, expected = self._transition(state, bit)
                    distance = int(np.count_nonzero(symbol != expected))
                    candidate = metrics[state] + distance
                    if candidate < next_metrics[next_state]:
                        next_metrics[next_state] = candidate
                        predecessors[step, next_state] = state
                        decisions[step, next_state] = bit
            metrics = next_metrics

        state = int(np.argmin(metrics))
        decoded = np.zeros(steps, dtype=np.uint8)
        for step in range(steps - 1, -1, -1):
            decoded[step] = decisions[step, state]
            state = int(predecessors[step, state])
        if traceback is None and steps >= self.memory:
            return decoded[:-self.memory]
        if traceback is not None:
            return decoded[:traceback]
        return decoded

    def _transition(self, state: int, bit: int) -> tuple[int, np.ndarray]:
        register = ((state << 1) | bit) & ((1 << self.constraint_length) - 1)
        next_state = register & ((1 << self.memory) - 1)
        expected = np.asarray(
            [(register & generator).bit_count() & 1 for generator in self.generators],
            dtype=np.uint8,
        )
        return next_state, expected


class ReedSolomonCode:
    """Systematic narrow-sense RS code over GF(256).

    The decoder uses syndrome search over error locations for the configured correction radius. This
    is exact for short engineering frames and avoids pretending an erasure-heavy production decoder
    exists before the platform needs very large packet blocks.
    """

    primitive_polynomial = 0x11D

    def __init__(self, parity_symbols: int = 8) -> None:
        if parity_symbols <= 0 or parity_symbols >= 255:
            raise ValueError("parity_symbols must be in [1, 254]")
        self.parity_symbols = parity_symbols
        self.gf_exp, self.gf_log = self._build_tables()
        self.generator = self._generator_poly(parity_symbols)

    def encode(self, payload: bytes) -> bytes:
        if len(payload) + self.parity_symbols > 255:
            raise ValueError("Reed-Solomon codeword length cannot exceed 255 symbols")
        message = list(payload) + [0] * self.parity_symbols
        for index in range(len(payload)):
            coefficient = message[index]
            if coefficient == 0:
                continue
            for gen_index, gen_value in enumerate(self.generator):
                message[index + gen_index] ^= self.mul(gen_value, coefficient)
        parity = bytes(message[-self.parity_symbols :])
        return bytes(payload) + parity

    def decode(self, codeword: bytes) -> tuple[bytes, int]:
        if len(codeword) > 255:
            raise ValueError("Reed-Solomon codeword length cannot exceed 255 symbols")
        received = list(codeword)
        syndrome = self.syndromes(received)
        if max(syndrome) == 0:
            return bytes(received[:-self.parity_symbols]), 0
        max_errors = self.parity_symbols // 2
        for error_count in range(1, max_errors + 1):
            for locations in combinations(range(len(received)), error_count):
                magnitudes = self._solve_error_magnitudes(syndrome, locations, len(received))
                if magnitudes is None:
                    continue
                candidate = received.copy()
                for location, magnitude in zip(locations, magnitudes, strict=True):
                    candidate[location] ^= magnitude
                if max(self.syndromes(candidate)) == 0:
                    return bytes(candidate[:-self.parity_symbols]), error_count
        raise ValueError("Reed-Solomon decoder could not correct the received codeword")

    def syndromes(self, codeword: list[int]) -> list[int]:
        return [self._poly_eval(codeword, self.gf_exp[i]) for i in range(self.parity_symbols)]

    def mul(self, left: int, right: int) -> int:
        if left == 0 or right == 0:
            return 0
        return self.gf_exp[self.gf_log[left] + self.gf_log[right]]

    def div(self, left: int, right: int) -> int:
        if right == 0:
            raise ZeroDivisionError("GF division by zero")
        if left == 0:
            return 0
        return self.gf_exp[(self.gf_log[left] - self.gf_log[right]) % 255]

    def pow(self, value: int, power: int) -> int:
        if power == 0:
            return 1
        if value == 0:
            return 0
        return self.gf_exp[(self.gf_log[value] * power) % 255]

    def _solve_error_magnitudes(
        self, syndrome: list[int], locations: tuple[int, ...], codeword_len: int
    ) -> list[int] | None:
        size = len(locations)
        matrix = np.zeros((size, size), dtype=np.uint8)
        vector = np.asarray(syndrome[:size], dtype=np.uint8)
        for row in range(size):
            for col, location in enumerate(locations):
                exponent = codeword_len - 1 - location
                matrix[row, col] = self.pow(self.gf_exp[row], exponent)
        return self._gf_solve(matrix, vector)

    def _gf_solve(self, matrix: np.ndarray, vector: np.ndarray) -> list[int] | None:
        a = matrix.astype(np.uint16).tolist()
        b = vector.astype(np.uint16).tolist()
        n = len(b)
        for col in range(n):
            pivot = next((row for row in range(col, n) if a[row][col] != 0), None)
            if pivot is None:
                return None
            if pivot != col:
                a[col], a[pivot] = a[pivot], a[col]
                b[col], b[pivot] = b[pivot], b[col]
            inv = self.div(1, int(a[col][col]))
            for j in range(col, n):
                a[col][j] = self.mul(int(a[col][j]), inv)
            b[col] = self.mul(int(b[col]), inv)
            for row in range(n):
                if row == col or a[row][col] == 0:
                    continue
                factor = int(a[row][col])
                for j in range(col, n):
                    a[row][j] ^= self.mul(factor, int(a[col][j]))
                b[row] ^= self.mul(factor, int(b[col]))
        return [int(value) for value in b]

    def _poly_eval(self, poly: list[int], x: int) -> int:
        y = poly[0]
        for coefficient in poly[1:]:
            y = self.mul(y, x) ^ coefficient
        return y

    def _generator_poly(self, parity_symbols: int) -> list[int]:
        generator = [1]
        for i in range(parity_symbols):
            generator = self._poly_mul(generator, [1, self.gf_exp[i]])
        return generator

    def _poly_mul(self, left: list[int], right: list[int]) -> list[int]:
        out = [0] * (len(left) + len(right) - 1)
        for i, left_value in enumerate(left):
            for j, right_value in enumerate(right):
                out[i + j] ^= self.mul(left_value, right_value)
        return out

    def _build_tables(self) -> tuple[list[int], list[int]]:
        exp = [0] * 512
        log = [0] * 256
        x = 1
        for i in range(255):
            exp[i] = x
            log[x] = i
            x <<= 1
            if x & 0x100:
                x ^= self.primitive_polynomial
        for i in range(255, 512):
            exp[i] = exp[i - 255]
        return exp, log


@dataclass(frozen=True)
class LDPCCode:
    parity_check: np.ndarray

    def __post_init__(self) -> None:
        h = _bits(self.parity_check)
        object.__setattr__(self, "parity_check", h)
        if h.ndim != 2:
            raise ValueError("parity_check must be a 2D matrix")

    def encode_systematic(self, data_bits: np.ndarray) -> np.ndarray:
        h = self.parity_check
        m, n = h.shape
        k = n - m
        data = _bits(data_bits)
        if data.size != k:
            raise ValueError(f"data_bits must contain {k} bits for this systematic LDPC matrix")
        p_matrix = h[:, :k]
        parity_part = h[:, k:]
        if not np.array_equal(parity_part, np.eye(m, dtype=np.uint8)):
            raise ValueError("encode_systematic requires H = [P | I]")
        parity = (p_matrix @ data) & 1
        return np.concatenate([data, parity.astype(np.uint8)])

    def min_sum_decode(self, llr: np.ndarray, iterations: int = 30) -> tuple[np.ndarray, bool]:
        h = self.parity_check
        llr = np.asarray(llr, dtype=np.float64)
        if llr.size != h.shape[1]:
            raise ValueError("LLR length must match LDPC codeword length")
        checks, variables = np.nonzero(h)
        q: dict[tuple[int, int], float] = {(c, v): float(llr[v]) for c, v in zip(checks, variables)}
        r: dict[tuple[int, int], float] = {(c, v): 0.0 for c, v in zip(checks, variables)}
        check_neighbors = [np.where(h[row] == 1)[0] for row in range(h.shape[0])]
        variable_neighbors = [np.where(h[:, col] == 1)[0] for col in range(h.shape[1])]

        hard = np.zeros(h.shape[1], dtype=np.uint8)
        for _ in range(iterations):
            for check, neighbors in enumerate(check_neighbors):
                for variable in neighbors:
                    incoming = [q[(check, other)] for other in neighbors if other != variable]
                    sign = np.prod(np.sign(incoming)) if incoming else 1.0
                    magnitude = min(abs(value) for value in incoming) if incoming else 0.0
                    r[(check, variable)] = float(sign * magnitude)
            total = llr.copy()
            for variable, neighbors in enumerate(variable_neighbors):
                total[variable] += sum(r[(check, variable)] for check in neighbors)
                for check in neighbors:
                    q[(check, variable)] = float(
                        llr[variable] + sum(r[(other, variable)] for other in neighbors if other != check)
                    )
            hard = (total < 0).astype(np.uint8)
            if np.all((h @ hard) % 2 == 0):
                return hard, True
        return hard, False


@dataclass(frozen=True)
class PolarCode:
    block_length: int
    info_indices: tuple[int, ...]

    def __post_init__(self) -> None:
        if self.block_length <= 0 or self.block_length & (self.block_length - 1):
            raise ValueError("block_length must be a power of two")
        if len(set(self.info_indices)) != len(self.info_indices):
            raise ValueError("info_indices must be unique")
        if any(index < 0 or index >= self.block_length for index in self.info_indices):
            raise ValueError("info index out of range")

    @classmethod
    def by_polarization_weight(cls, block_length: int, information_bits: int) -> PolarCode:
        weights = []
        beta = 2**0.25
        for index in range(block_length):
            weight = 0.0
            bit = 0
            value = index
            while value:
                if value & 1:
                    weight += beta**bit
                bit += 1
                value >>= 1
            weights.append((weight, index))
        reliable = tuple(sorted(index for _, index in sorted(weights)[-information_bits:]))
        return cls(block_length=block_length, info_indices=reliable)

    def encode(self, data_bits: np.ndarray) -> np.ndarray:
        data = _bits(data_bits)
        if data.size != len(self.info_indices):
            raise ValueError("data length must match number of polar information indices")
        u = np.zeros(self.block_length, dtype=np.uint8)
        u[list(self.info_indices)] = data
        return polar_transform(u)

    def sc_decode(self, llr: np.ndarray) -> np.ndarray:
        llr = np.asarray(llr, dtype=np.float64)
        if llr.size != self.block_length:
            raise ValueError("LLR length must match polar block length")
        if self.block_length <= 16:
            return self._maximum_likelihood_decode(llr)
        frozen = np.ones(self.block_length, dtype=bool)
        frozen[list(self.info_indices)] = False
        u_hat = _sc_decode_recursive(llr, frozen)
        return u_hat[list(self.info_indices)].astype(np.uint8)

    def _maximum_likelihood_decode(self, llr: np.ndarray) -> np.ndarray:
        best_metric = -np.inf
        best_data: np.ndarray | None = None
        for candidate in product((0, 1), repeat=len(self.info_indices)):
            data = np.asarray(candidate, dtype=np.uint8)
            codeword = self.encode(data)
            metric = float(np.sum(llr * (1 - 2 * codeword.astype(np.int16))))
            if metric > best_metric:
                best_metric = metric
                best_data = data
        if best_data is None:
            raise ValueError("unable to decode empty polar candidate set")
        return best_data


def polar_transform(bits: np.ndarray) -> np.ndarray:
    out = _bits(bits).copy()
    n = out.size
    step = 1
    while step < n:
        for start in range(0, n, step * 2):
            left = slice(start, start + step)
            right = slice(start + step, start + 2 * step)
            out[left] ^= out[right]
        step *= 2
    return out


def _sc_decode_recursive(llr: np.ndarray, frozen: np.ndarray) -> np.ndarray:
    n = llr.size
    if n == 1:
        return np.array([0 if frozen[0] or llr[0] >= 0 else 1], dtype=np.uint8)
    half = n // 2
    left_llr = np.sign(llr[:half]) * np.sign(llr[half:]) * np.minimum(
        np.abs(llr[:half]), np.abs(llr[half:])
    )
    left = _sc_decode_recursive(left_llr, frozen[:half])
    right_llr = llr[half:] + (1 - 2 * left.astype(np.int16)) * llr[:half]
    right = _sc_decode_recursive(right_llr, frozen[half:])
    return np.concatenate([left, right]).astype(np.uint8)


class AdaptiveCodingController:
    def select(self, snr_db: float) -> str:
        if snr_db < 4:
            return "polar_low_rate"
        if snr_db < 10:
            return "ldpc_robust"
        if snr_db < 18:
            return "convolutional"
        if snr_db < 28:
            return "reed_solomon_outer"
        return "uncoded_crc"


def exhaustive_minimum_distance(generator: np.ndarray) -> int:
    g = _bits(generator)
    k = g.shape[0]
    distances = []
    for bits in product((0, 1), repeat=k):
        word = (np.asarray(bits, dtype=np.uint8) @ g) & 1
        weight = int(np.count_nonzero(word))
        if weight:
            distances.append(weight)
    return min(distances) if distances else 0
