#!/usr/bin/env python3
"""Create a consistent SQLite backup, including WAL content."""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    source = Path(os.environ.get("DB_PATH", root / "data" / "recovery.sqlite"))
    target_dir = root / "data" / "backups"
    target_dir.mkdir(parents=True, exist_ok=True)
    if not source.exists():
        print(f"Database not found: {source}", file=sys.stderr)
        return 2
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = target_dir / f"recovery-{stamp}.sqlite"
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
