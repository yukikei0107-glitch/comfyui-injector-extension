# -*- coding: utf-8 -*-
# 衣装ガチャ（スマホ版）を ComfyUI と同一オリジンで配信し、
# スマホ⇔PC でお取り置きを共有するための軽量エンドポイントを追加するカスタムノード。
#
# 配信: web/ 以下が /extensions/comfyui_gacha_mobile/ で配信される。
#   例: http://<ComfyUIのIP>:8188/extensions/comfyui_gacha_mobile/gacha.html
# 共有: GET /gacha/reserved  → 保存済みお取り置きJSONを返す
#       POST /gacha/reserved → お取り置きJSONを保存（スマホがpush、PCがpull）
#
# 導入: このフォルダごと ComfyUI/custom_nodes/ に置いて ComfyUI を再起動するだけ。

import os
import json

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

_RESERVED_FILE = os.path.join(os.path.dirname(__file__), "reserved_shared.json")

try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/gacha/reserved")
    async def _gacha_get_reserved(request):
        try:
            if os.path.exists(_RESERVED_FILE):
                with open(_RESERVED_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            else:
                data = []
        except Exception:
            data = []
        if not isinstance(data, list):
            data = []
        return web.json_response(data)

    @PromptServer.instance.routes.post("/gacha/reserved")
    async def _gacha_set_reserved(request):
        try:
            data = await request.json()
            if not isinstance(data, list):
                return web.json_response({"ok": False, "error": "expected a list"}, status=400)
            with open(_RESERVED_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            return web.json_response({"ok": True, "count": len(data)})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=400)

    print("[comfyui_gacha_mobile] loaded: /extensions/comfyui_gacha_mobile/gacha.html , /gacha/reserved")
except Exception as e:
    print("[comfyui_gacha_mobile] route setup skipped:", e)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
