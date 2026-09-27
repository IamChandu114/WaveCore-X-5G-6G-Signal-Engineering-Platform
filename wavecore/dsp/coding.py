import numpy as np


CRC16_CCITT_POLY = 0x1021
CRC16_INIT = 0xFFFF


def crc16_ccitt(bits: np.ndarray) -> int:
    crc = CRC16_INIT
    for bit in np.asarray(bits, dtype=np.uint8):
        crc ^= int(bit) << 15
        for _ in range(1):
            if crc & 0x8000:
                crc = ((crc << 1) ^ CRC16_CCITT_POLY) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


def append_crc16(bits: np.ndarray) -> np.ndarray:
    payload = np.asarray(bits, dtype=np.uint8)
    crc = crc16_ccitt(payload)
    crc_bits = np.array([(crc >> i) & 1 for i in range(15, -1, -1)], dtype=np.uint8)
    return np.concatenate([payload, crc_bits])


def verify_crc16(bits_with_crc: np.ndarray) -> tuple[np.ndarray, bool]:
    frame = np.asarray(bits_with_crc, dtype=np.uint8)
    if frame.size < 16:
        return frame, False
    payload = frame[:-16]
    received_crc = int("".join(str(int(b)) for b in frame[-16:]), 2)
    return payload, crc16_ccitt(payload) == received_crc


def hamming74_encode(bits: np.ndarray) -> np.ndarray:
    arr = np.asarray(bits, dtype=np.uint8)
    pad = (-arr.size) % 4
    if pad:
        arr = np.concatenate([arr, np.zeros(pad, dtype=np.uint8)])
    blocks = arr.reshape(-1, 4)
    codewords = []
    for d1, d2, d3, d4 in blocks:
        p1 = d1 ^ d2 ^ d4
        p2 = d1 ^ d3 ^ d4
        p3 = d2 ^ d3 ^ d4
        codewords.append([p1, p2, d1, p3, d2, d3, d4])
    return np.asarray(codewords, dtype=np.uint8).reshape(-1)


def hamming74_decode(code_bits: np.ndarray) -> tuple[np.ndarray, int]:
    arr = np.asarray(code_bits, dtype=np.uint8)
    usable = (arr.size // 7) * 7
    blocks = arr[:usable].reshape(-1, 7)
    decoded = []
    corrected = 0
    for word in blocks:
        p1, p2, d1, p3, d2, d3, d4 = word.copy()
        s1 = p1 ^ d1 ^ d2 ^ d4
        s2 = p2 ^ d1 ^ d3 ^ d4
        s3 = p3 ^ d2 ^ d3 ^ d4
        syndrome = int(s1) + (int(s2) << 1) + (int(s3) << 2)
        corrected_word = word.copy()
        if syndrome:
            corrected_word[syndrome - 1] ^= 1
            corrected += 1
        decoded.append([corrected_word[2], corrected_word[4], corrected_word[5], corrected_word[6]])
    return np.asarray(decoded, dtype=np.uint8).reshape(-1), corrected

