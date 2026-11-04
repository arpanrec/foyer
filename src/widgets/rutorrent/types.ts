// A torrent as the proxy returns it; every value is the raw rTorrent field
export type RutorrentTorrent = {
    "d.is_open": unknown;
    "d.is_hash_checking": unknown;
    "d.is_hash_checked": unknown;
    "d.get_state": unknown;
    "d.get_name": unknown;
    "d.get_size_bytes": unknown;
    "d.get_completed_chunks": unknown;
    "d.get_size_chunks": unknown;
    "d.get_bytes_done": unknown;
    "d.get_up_total": unknown;
    "d.get_ratio": unknown;
    "d.get_up_rate": string;
    "d.get_down_rate": string;
    "d.get_chunk_size": unknown;
    "d.get_custom1": unknown;
    "d.get_peers_accounted": unknown;
    "d.get_peers_not_connected": unknown;
    "d.get_peers_connected": unknown;
    "d.get_peers_complete": unknown;
    "d.get_left_bytes": unknown;
    "d.get_priority": unknown;
    "d.get_state_changed": unknown;
    "d.get_skip_total": unknown;
    "d.get_hashing": unknown;
    "d.get_chunks_hashed": unknown;
    "d.get_base_path": unknown;
    "d.get_creation_date": unknown;
    "d.get_tracker_focus": unknown;
    "d.is_active": unknown;
    "d.get_message": unknown;
    "d.get_custom2": unknown;
    "d.get_free_diskspace": unknown;
    "d.is_private": unknown;
    "d.is_multi_file": unknown;
};

export type RutorrentListResponse = { t: Record<string, unknown[]> };
