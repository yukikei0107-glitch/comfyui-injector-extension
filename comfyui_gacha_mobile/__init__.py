# -*- coding: utf-8 -*-
# 衣装ガチャ（スマホ版）を ComfyUI と同一オリジンで配信し、
# スマホ⇔PC でお取り置き共有＋AI提案(LM Studio中継)を行うカスタムノード。
#
# 配信: web/ 以下が /extensions/comfyui_gacha_mobile/ で配信される。
#   例: http://<ComfyUIのIP>:8188/extensions/comfyui_gacha_mobile/gacha.html
# 共有: GET/POST /gacha/reserved → お取り置きJSONの取得/保存
# AI  : POST /gacha/llm → LM Studio(OpenAI互換)へ中継してAI提案
#
# LM Studio のURL:
#   既定は http://127.0.0.1:1234（ComfyUIとLM Studioが同じPC＝MERUの場合はこのままでOK）。
#   別PCなら環境変数 GACHA_LMSTUDIO_URL="http://<LM StudioのIP>:1234" を設定。
#
# 導入: このフォルダごと ComfyUI/custom_nodes/ に置いて ComfyUI を再起動。

import os
import json

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

_RESERVED_FILE = os.path.join(os.path.dirname(__file__), "reserved_shared.json")
_LMSTUDIO_URL = os.environ.get("GACHA_LMSTUDIO_URL", "http://127.0.0.1:1234").rstrip("/")

try:
    from server import PromptServer
    from aiohttp import web
    import aiohttp

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

    @PromptServer.instance.routes.post("/gacha/llm")
    async def _gacha_llm(request):
        try:
            body = await request.json()
            system = body.get("system", "")
            prompt = body.get("prompt", "")
            temperature = body.get("temperature", 0.9)
            max_tokens = body.get("max_tokens", 400)
            # 中継先URL：スマホから指定があればそれを優先（例: http://<MERUのIP>:1234）
            base = (body.get("lmstudio_url") or _LMSTUDIO_URL).strip().rstrip("/")
            if not base.startswith("http"):
                base = _LMSTUDIO_URL
            timeout = aiohttp.ClientTimeout(total=180)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # ロード中のモデルIDを自動取得（無ければ local-model）
                model_id = body.get("model") or "local-model"
                try:
                    async with session.get(base + "/v1/models") as mr:
                        models = await mr.json()
                        if isinstance(models, dict) and models.get("data"):
                            model_id = models["data"][0].get("id", model_id)
                except Exception:
                    pass
                payload = {
                    "model": model_id,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                }
                async with session.post(base + "/v1/chat/completions", json=payload) as resp:
                    if resp.status != 200:
                        txt = await resp.text()
                        return web.json_response({"ok": False, "error": "LM Studio HTTP %d: %s" % (resp.status, txt[:200])}, status=502)
                    data = await resp.json()
            text = ""
            try:
                text = data["choices"][0]["message"]["content"]
            except Exception:
                text = ""
            return web.json_response({"ok": True, "text": text, "model": model_id})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)

    print("[comfyui_gacha_mobile] loaded: gacha.html / /gacha/reserved / /gacha/llm (LM Studio: %s)" % _LMSTUDIO_URL)
except Exception as e:
    print("[comfyui_gacha_mobile] route setup skipped:", e)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
