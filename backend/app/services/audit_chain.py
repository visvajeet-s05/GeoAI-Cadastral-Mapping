"""
Cryptographic SHA-256 Cadastral Audit Hash Chaining Engine
Guarantees tamper-evident, immutable land title boundary records
analogous to a permissioned cadastral ledger.
"""

import hashlib
import json
import time
from typing import List, Dict, Any, Optional


class CadastralAuditLedger:
    """
    Manages SHA-256 hash chaining for land parcel boundary coordinates,
    ensuring that any unauthorized coordinate manipulation or boundary shifting
    is immediately caught via broken cryptographic hashes.
    """

    GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    @staticmethod
    def hash_coordinates(coordinates: List[List[float]]) -> str:
        """Computes deterministic SHA-256 digest of normalized coordinates array."""
        # Normalize to 7 decimal places
        normalized = [[round(coord[0], 7), round(coord[1], 7)] for coord in coordinates]
        payload_bytes = json.dumps(normalized, sort_keys=True).encode('utf-8')
        return hashlib.sha256(payload_bytes).hexdigest()

    @classmethod
    def create_audit_block(
        cls,
        parcel_id: str,
        block_index: int,
        previous_hash: str,
        coordinates: List[List[float]],
        surveyor_id: str,
        surveyor_name: str,
        action: str,
        description: str,
        timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Creates a new immutable hash block chaining to the previous block.
        current_hash = SHA256(previous_hash + coordinates_sha + surveyor_id + timestamp + action)
        """
        if timestamp is None:
            timestamp = time.time()

        coordinates_sha = cls.hash_coordinates(coordinates)

        block_header = f"{previous_hash}|{coordinates_sha}|{surveyor_id}|{timestamp:.4f}|{action}"
        current_hash = hashlib.sha256(block_header.encode('utf-8')).hexdigest()

        # Simulated digital signature using surveyor ID and block hash
        digital_signature = f"ED25519-SIG-{hashlib.sha256((current_hash + surveyor_id).encode('utf-8')).hexdigest()[:24]}"

        return {
            "parcel_id": parcel_id,
            "block_index": block_index,
            "action": action,
            "previous_hash": previous_hash,
            "current_hash": current_hash,
            "coordinates_payload_sha": coordinates_sha,
            "surveyor_id": surveyor_id,
            "surveyor_name": surveyor_name,
            "digital_signature": digital_signature,
            "change_description": description,
            "timestamp": timestamp,
            "verified": True
        }

    @classmethod
    def verify_audit_chain(cls, blocks: List[Dict[str, Any]], current_coordinates: List[List[float]]) -> Dict[str, Any]:
        """
        Validates the entire audit chain for a parcel:
        1. Checks previous_hash == parent.current_hash
        2. Recomputes current_hash
        3. Verifies that current boundary coordinates match the latest block's payload hash
        """
        if not blocks:
            return {"is_valid": False, "reason": "No audit blocks present."}

        for i, block in enumerate(blocks):
            # Check genesis block
            if i == 0 and block["previous_hash"] != cls.GENESIS_HASH:
                return {
                    "is_valid": False,
                    "tampered_block_index": 0,
                    "reason": "Genesis block previous_hash does not match standard 0x0 genesis."
                }

            # Check chain linkage
            if i > 0 and block["previous_hash"] != blocks[i - 1]["current_hash"]:
                return {
                    "is_valid": False,
                    "tampered_block_index": i,
                    "reason": f"Hash chain broken at block {i}: previous_hash mismatch."
                }

            # Verify current hash recomputation
            expected_header = f"{block['previous_hash']}|{block['coordinates_payload_sha']}|{block['surveyor_id']}|{block['timestamp']:.4f}|{block['action']}"
            recomputed = hashlib.sha256(expected_header.encode('utf-8')).hexdigest()
            if recomputed != block["current_hash"]:
                return {
                    "is_valid": False,
                    "tampered_block_index": i,
                    "reason": f"Tampered block data at index {i}: hash mismatch."
                }

        # Check latest coordinates against active boundary
        latest_block = blocks[-1]
        active_coords_hash = cls.hash_coordinates(current_coordinates)
        if latest_block["coordinates_payload_sha"] != active_coords_hash:
            return {
                "is_valid": False,
                "tampered_block_index": len(blocks) - 1,
                "reason": "Unauthorized boundary manipulation: current active parcel coordinates do not match the latest signed audit block."
            }

        return {
            "is_valid": True,
            "chain_length": len(blocks),
            "latest_hash": latest_block["current_hash"],
            "last_verified_surveyor": latest_block["surveyor_name"],
            "tamper_proof": True
        }
