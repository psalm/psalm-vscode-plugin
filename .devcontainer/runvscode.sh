RETRIES=20
DELAY=10
COUNT=1
while [ $COUNT -lt $RETRIES ]; do
  git clone https://github.com/microsoft/vscode.git /workspaces/vscode
  if [ $? -eq 0 ]; then
    RETRIES=0
    break
  fi
  let COUNT=$COUNT+1
  sleep $DELAY
done
cd /workspaces/vscode
yarn install
bash scripts/code.sh --no-sandbox
sed -i -E 's/.*Terminal.*/    [exec] (Terminal) { tilix -w ~ -e $(readlink -f \/proc\/$$\/exe) -il } <>\n    [exec] (Start Code - OSS) { tilix -t "Code - OSS Build" -e bash \/workspaces\/vscode\/scripts\/code.sh --no-sandbox  } <>/' ~/.fluxbox/menu