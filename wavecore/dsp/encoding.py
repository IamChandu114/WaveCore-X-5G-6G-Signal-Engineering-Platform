import numpy as np


class MessageCodec:
    @staticmethod
    def text_to_bits(message: str, encoding: str = "utf-8") -> np.ndarray:
        payload = message.encode(encoding)
        return np.unpackbits(np.frombuffer(payload, dtype=np.uint8)).astype(np.uint8)

    @staticmethod
    def bits_to_text(bits: np.ndarray, encoding: str = "utf-8") -> str:
        clean = np.asarray(bits, dtype=np.uint8)
        usable_len = (clean.size // 8) * 8
        if usable_len == 0:
            return ""
        bytes_out = np.packbits(clean[:usable_len]).tobytes()
        return bytes_out.decode(encoding, errors="replace").rstrip("\x00")


def pad_bits(bits: np.ndarray, block_size: int) -> tuple[np.ndarray, int]:
    if block_size <= 0:
        raise ValueError("block_size must be positive")
    arr = np.asarray(bits, dtype=np.uint8)
    pad = (-arr.size) % block_size
    if pad == 0:
        return arr.copy(), 0
    return np.concatenate([arr, np.zeros(pad, dtype=np.uint8)]), pad


def unpad_bits(bits: np.ndarray, pad: int) -> np.ndarray:
    arr = np.asarray(bits, dtype=np.uint8)
    if pad == 0:
        return arr
    if pad < 0 or pad > arr.size:
        raise ValueError("invalid pad length")
    return arr[:-pad]

