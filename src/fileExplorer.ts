import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FileExplorerProvider implements vscode.TreeDataProvider<FileItem>, vscode.TreeDragAndDropController<FileItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<FileItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    dropMimeTypes = ['text/uri-list'];
    dragMimeTypes = ['text/uri-list'];

    getTreeItem(element: FileItem): vscode.TreeItem {
        let treeItem = new vscode.TreeItem(
            element.label,
            element.isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        treeItem.resourceUri = vscode.Uri.file(element.fullPath);
        if (!element.isDirectory) {
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [treeItem.resourceUri]
            };
        }
        return treeItem;
    }

    getChildren(element?: FileItem): FileItem[] | Thenable<FileItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }
        if (!element) {
            let rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            return this.readDirectory(rootPath);
        } else {
            return this.readDirectory(element.fullPath);
        }
    }

    async handleDrag(source: FileItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        // 今回は特に処理を入れずに実装
    }

    async handleDrop(target: FileItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (!target || !vscode.workspace.workspaceFolders) {
            return;
        }
        let rootPath = path.dirname(target.fullPath);
        if (target.isDirectory) {
            rootPath = target.fullPath;
        }
        let dropItems = dataTransfer.get('text/uri-list');
        if (!dropItems) {
            return;
        }
        if (typeof dropItems.value !== 'string') {
            return;
        }
        let uriList = dropItems.value.split('\n').map(l => l.trim()).filter(l => !!l);
        let files: string[] = uriList.map(u => vscode.Uri.parse(u).fsPath);
        await this.updateFileOrder(rootPath, files);
        this._onDidChangeTreeData.fire(undefined);
    }

    private async readDirectory(dirPath: string): Promise<FileItem[]> {
        try {
            let entries = fs.readdirSync(dirPath, { withFileTypes: true });
            let fileOrder = this.readFileOrder(dirPath);

            // すべてのエントリをFileItemに変換
            let files = entries.map(e => {
                return new FileItem(
                    path.join(dirPath, e.name),
                    e.name,
                    e.isDirectory()
                );
            });

            // .fileorderに書かれたファイルとそうでないファイルに分ける
            let ordered: FileItem[] = [];
            let unordered: FileItem[] = [];

            for (let f of files) {
                if (fileOrder.indexOf(f.name) !== -1) {
                    ordered.push(f);
                } else {
                    unordered.push(f);
                }
            }

            // orderedは.fileorderに書かれた順序
            ordered.sort((a, b) => {
                return fileOrder.indexOf(a.name) - fileOrder.indexOf(b.name);
            });

            // unorderedは名前順（VSCode標準準拠の単純なlocaleCompare）
            unordered.sort((a, b) => a.name.localeCompare(b.name));

            // 最終的な並び順
            return [...ordered, ...unordered];

        } catch {
            return [];
        }
    }

    private readFileOrder(dirPath: string): string[] {
        let orderPath = path.join(dirPath, '.fileorder');
        if (!fs.existsSync(orderPath)) {
            return [];
        }
        try {
            let content = fs.readFileSync(orderPath, 'utf8');
            return content.split('\n')
                .map(s => s.trim())
                .filter(s => s !== '');
        } catch {
            return [];
        }
    }

    private writeFileOrder(dirPath: string, fileList: string[]) {
        let orderPath = path.join(dirPath, '.fileorder');
        fs.writeFileSync(orderPath, fileList.join('\n'), 'utf8');
    }

    private async updateFileOrder(dirPath: string, dropFiles: string[]) {
        let existingOrder = this.readFileOrder(dirPath);
        let finalOrder = existingOrder.slice();

        // ドロップされたファイル名を末尾に移動/追加
        for (let filePath of dropFiles) {
            let fileName = path.basename(filePath);

            // 既に.fileorderにある場合、一度削除して末尾に追加
            if (finalOrder.includes(fileName)) {
                let idx = finalOrder.indexOf(fileName);
                finalOrder.splice(idx, 1);
            }
            finalOrder.push(fileName);
        }

        this.writeFileOrder(dirPath, finalOrder);
    }
}

export class FileItem {
    constructor(
        public fullPath: string,
        public name: string,
        public isDirectory: boolean
    ) {}

    get label(): string {
        return this.name;
    }
}
