from pathlib import Path

from PIL import Image


ASSET_NAMES = (
    "icon.png",
    "splash-icon.png",
    "favicon.png",
    "android-icon-foreground.png",
)
ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "images"


def optimize_asset(path: Path) -> None:
    with Image.open(path) as source:
        image = source.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    for name in ASSET_NAMES:
        optimize_asset(ASSET_DIR / name)


if __name__ == "__main__":
    main()
