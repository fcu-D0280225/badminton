#!/usr/bin/env bash
# 羽毛球預約系統 - 重新部署腳本
#
# 用法：
#   ./deploy.sh             # 智慧模式：依 git diff 決定要重部哪些服務
#   ./deploy.sh --all       # 強制全部重 install/build/restart
#   ./deploy.sh --no-pull   # 不要 git pull，只用目前工作目錄重部
#   ./deploy.sh backend     # 只重部 backend（也可指定 frontend / venue）

set -euo pipefail

# 切到腳本所在目錄（= 專案根目錄）
cd "$(dirname "$(readlink -f "$0")")"

# ---------- 顏色 ----------
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'
  C_BLUE=$'\e[34m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_RED=$'\e[31m'
else
  C_RESET=''; C_BOLD=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''
fi
log()  { echo "${C_BLUE}▶${C_RESET} $*"; }
ok()   { echo "${C_GREEN}✓${C_RESET} $*"; }
warn() { echo "${C_YELLOW}!${C_RESET} $*"; }
err()  { echo "${C_RED}✗${C_RESET} $*" >&2; }

# ---------- 參數 ----------
FORCE_ALL=false
DO_PULL=true
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)     FORCE_ALL=true ;;
    --no-pull) DO_PULL=false ;;
    backend|frontend|venue|venue-app)
      ONLY="$1"
      [[ "$ONLY" == "venue" ]] && ONLY="venue-app"
      ;;
    -h|--help)
      sed -n '2,11p' "$0"; exit 0 ;;
    *)
      err "未知參數：$1"; exit 1 ;;
  esac
  shift
done

# ---------- 預檢 ----------
command -v pm2 >/dev/null || { err "找不到 pm2"; exit 1; }
command -v npm >/dev/null || { err "找不到 npm"; exit 1; }

# ---------- git pull ----------
BEFORE=""; AFTER=""
if $DO_PULL; then
  log "git pull..."
  BEFORE=$(git rev-parse HEAD)
  git pull --ff-only
  AFTER=$(git rev-parse HEAD)
  if [[ "$BEFORE" == "$AFTER" ]]; then
    if ! $FORCE_ALL && [[ -z "$ONLY" ]]; then
      ok "沒有新 commit，無需部署（如要強制重部請加 --all）"
      exit 0
    fi
    warn "沒有新 commit，但仍依參數繼續"
  else
    ok "已更新：$BEFORE → $AFTER"
  fi
fi

# ---------- 決定要部哪些 ----------
deploy_backend=false;  install_backend=false
deploy_frontend=false; install_frontend=false
deploy_venue=false;    install_venue=false

if [[ -n "$ONLY" ]]; then
  case "$ONLY" in
    backend)    deploy_backend=true;  install_backend=true ;;
    frontend)   deploy_frontend=true; install_frontend=true ;;
    venue-app)  deploy_venue=true;    install_venue=true ;;
  esac
elif $FORCE_ALL || [[ -z "$BEFORE" ]]; then
  deploy_backend=true;  install_backend=true
  deploy_frontend=true; install_frontend=true
  deploy_venue=true;    install_venue=true
else
  CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" || true)
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    case "$f" in
      backend/package*.json)    install_backend=true; deploy_backend=true ;;
      backend/*)                deploy_backend=true ;;
      frontend/package*.json)   install_frontend=true; deploy_frontend=true ;;
      frontend/*)               deploy_frontend=true ;;
      venue-app/package*.json)  install_venue=true; deploy_venue=true ;;
      venue-app/*)              deploy_venue=true ;;
    esac
  done <<< "$CHANGED"
fi

# ---------- 部署函式 ----------
deploy_one() {
  local name="$1" dir="$2" pm2_name="$3" do_install="$4" do_build="$5"
  log "${C_BOLD}部署 $name${C_RESET}（$dir）"
  pushd "$dir" >/dev/null

  if [[ "$do_install" == "true" ]]; then
    log "  npm install..."
    npm install --no-audit --no-fund
  fi

  if [[ "$do_build" == "true" ]]; then
    log "  npm run build..."
    npm run build
  fi

  # 注意：不可加 --update-env！本專案有些 secret 只活在 PM2 process memory，
  # --update-env 會用當前 shell 的 env 覆蓋 PM2 saved env，導致 secret 遺失。
  # 如要更新環境變數，請寫進對應的 .env 檔（NestJS 用 dotenv 自動載入）。
  log "  pm2 restart $pm2_name..."
  pm2 restart "$pm2_name"

  popd >/dev/null
  ok "$name 完成"
}

# ---------- 執行 ----------
ANY=false

if $deploy_backend; then
  deploy_one "backend"  "backend"   "badminton-backend"   "$install_backend" "true"
  ANY=true
fi

if $deploy_frontend; then
  # frontend 是純 PWA + Express，沒有真正的 build step
  deploy_one "frontend" "frontend"  "badminton-frontend"  "$install_frontend" "false"
  ANY=true
fi

if $deploy_venue; then
  deploy_one "venue-app" "venue-app" "badminton-venue-app" "$install_venue" "false"
  ANY=true
fi

if ! $ANY; then
  ok "沒有需要重部的服務"
  exit 0
fi

# ---------- 結尾 ----------
echo
log "PM2 狀態："
pm2 list | grep -E "badminton-|^┌|^├|^└|^│ id" || true
echo
ok "部署完成。如需查看 log：${C_BOLD}pm2 logs badminton-backend --lines 50${C_RESET}"
