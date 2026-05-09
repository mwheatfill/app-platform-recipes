# Icons

Replace these placeholders with real PNGs before sideloading.

| File | Size | Format | Purpose |
| --- | --- | --- | --- |
| `color.png` | 192×192 | PNG with transparency | Color icon shown in Teams catalog and chat |
| `outline.png` | 32×32 | PNG, white-on-transparent | Outline icon for Teams sidebar / activity feed |

Both are required by the Teams app manifest validator. Sideload will fail without them.

Quick way to generate placeholders:

```bash
# Using ImageMagick — replace with real icons before publishing
magick -size 192x192 xc:'#0F6CBD' color.png
magick -size 32x32 xc:white -alpha set -channel A -evaluate set 50% outline.png
```
