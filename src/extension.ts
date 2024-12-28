import * as vscode from 'vscode';
import { FileExplorerProvider } from './fileExplorer';

export function activate(context: vscode.ExtensionContext) {
    let provider = new FileExplorerProvider();
    let view = vscode.window.createTreeView('orderableFilesExplorer', {
        treeDataProvider: provider,
        showCollapseAll: true,
        dragAndDropController: provider
    });
    context.subscriptions.push(view);
}

export function deactivate() {}
