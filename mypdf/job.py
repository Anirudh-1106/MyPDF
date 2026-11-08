from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .core import ToolError


@dataclass
class Job:
    files: list[Path]
    opts: dict
    out_dir: Path
    assets: dict[str, Path] = field(default_factory=dict)
    store_dir: Path | None = None  # where opened documents / scans live (by id)
    message: str = ""

    @property
    def password(self):
        return self.opts.get("password") or None

    def out(self, name: str) -> Path:
        """Unique output path inside the job folder."""
        name = "".join(c for c in name if c not in '<>:"/\\|?*').strip() or "output"
        p = self.out_dir / name
        i = 2
        while p.exists():
            p = self.out_dir / f"{Path(name).stem} ({i}){Path(name).suffix}"
            i += 1
        return p

    def require(self, n: int = 1, maximum: int | None = None) -> list[Path]:
        if len(self.files) < n:
            raise ToolError(f"Please add {'at least ' if maximum != n else ''}{n} file{'s' if n > 1 else ''}.")
        if maximum and len(self.files) > maximum:
            raise ToolError(f"Please add at most {maximum} file{'s' if maximum > 1 else ''}.")
        return self.files

    def first(self) -> Path:
        return self.require(1)[0]

    def doc_path(self, doc_id: str) -> Path:
        """Path of a document previously stored via /api/open or /api/scan/detect."""
        if self.store_dir and re.fullmatch(r"[a-f0-9]{8,32}", str(doc_id)):
            for p in (self.store_dir / doc_id).glob("doc.*"):
                return p
        raise ToolError("The opened document has expired. Please open it again.")
