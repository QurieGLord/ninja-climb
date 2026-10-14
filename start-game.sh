#!/usr/bin/env bash
set -Eeuo pipefail

# Always resolve paths from this file, including when launched from a file manager.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_dir"

# Leave launch failures readable in the desktop launcher's terminal.
trap 'status=$?; if (( status != 0 )) && [[ -t 0 ]]; then printf "\nНажмите Enter, чтобы закрыть окно."; read -r || true; fi' EXIT

node_binary=""
for candidate in "${NINJA_NODE:-}" "$(command -v node || true)" "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
  [[ -n "$candidate" && -x "$candidate" ]] || continue
  if "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)' 2>/dev/null; then
    node_binary="$candidate"
    break
  fi
done
if [[ -z "$node_binary" ]]; then
  printf 'Для запуска нужен Node.js 22.12 или новее. Установите Node.js и повторите запуск.\n' >&2
  exit 1
fi
export PATH="$(dirname -- "$node_binary"):$PATH"

if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    printf 'Не найдены зависимости проекта и npm. Установите npm 10+ и выполните npm ci в папке игры.\n' >&2
    exit 1
  fi
  printf 'Первый запуск: устанавливаем зависимости проекта…\n'
  npm ci
fi

"$node_binary" --input-type=module - "$@" <<'JS'
import {createServer} from 'vite';
import {spawn} from 'node:child_process';

let server;
try {
  const options=process.argv.slice(2);
  if(options.some(option=>option!=='--no-open')) throw new Error('Использование: ./start-game.sh [--no-open]');
  const port=Number(process.env.NINJA_PORT??4173);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('NINJA_PORT должен быть числом от 1 до 65535.');
  const url=`http://127.0.0.1:${port}/`;
  const openBrowser=()=>{
    if(options.includes('--no-open'))return;
    const command=process.platform==='darwin'?'open':'xdg-open';
    const child=spawn(command,[url],{detached:true,stdio:'ignore'});
    child.on('error',()=>console.log(`Не удалось открыть браузер автоматически. Откройте ${url}`));
    child.unref();
  };
  // Reuse a running copy without changing ports (and therefore save origins).
  const existing=await fetch(url,{signal:AbortSignal.timeout(1200),redirect:'error'}).catch(()=>null);
  if(existing){
    const html=await existing.text();
    if(!existing.ok||!html.includes('<title>Ninja Climb — Путь в облака</title>')||!html.includes('id="app"')){
      throw new Error(`Порт ${port} занят другой программой. Освободите его или задайте NINJA_PORT.`);
    }
    console.log(`Ninja Climb уже запущена: ${url}`);
    openBrowser();
  }else{
    server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port,strictPort:true,open:false}});
    await server.listen();
    console.log(`\nNinja Climb готова: ${url}\nДля остановки закройте это окно или нажмите Ctrl+C.\n`);
    openBrowser();
    let closing=false;
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{
      if(closing)return;closing=true;
      await server.close();process.exit(0);
    });
  }
}catch(error){
  await server?.close();
  console.error(`Не удалось запустить игру: ${error.message}`);
  process.exitCode=1;
}
JS
