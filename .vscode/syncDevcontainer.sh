if [ -z $1 ] 
then
    thisrepo=$(pwd)
else
    thisrepo=$1
fi
echo $thisrepo
randv=$RANDOM
cd /tmp
rm -rf vscode$randv
git clone https://github.com/microsoft/vscode.git vscode$randv
cd vscode$randv
rm -rf $thisrepo/.devcontainer
cp -r .devcontainer $thisrepo
cd ..
rm -rf vscode$randv