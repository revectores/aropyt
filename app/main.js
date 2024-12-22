const {app, BrowserWindow, dialog, WebContents} = require('electron');
const fs = require('fs');
require('@electron/remote/main').initialize()

const windows = new Set();
const openFiles = new Map();

app.on('ready', () => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
        return false;
    }
    app.quit();
});

app.on('will-finish-launching', () => {
    app.on('open-file', (event, file) => {
        const win = createWindow();
        win.once('ready-to-show', () => {
            openFile(win, file);
        })
    })
})

app.on('activate', (event, hasVisibleWindows) => {
    if (!hasVisibleWindows) {createWindow();}
})

const createWindow = exports.createWindow = () => {
    let x, y;

    const currentWindow = BrowserWindow.getFocusedWindow();

    if (currentWindow) {
        const [currentWindowX, currentWindowY] = currentWindow.getPosition();
        x = currentWindowX + 10;
        y = currentWindowY + 10;
    }

    let newWindow = new BrowserWindow({
        x, y,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false
    });
    require('@electron/remote/main').enable(newWindow.webContents);
    newWindow.loadFile('./app/index.html');
    newWindow.once('ready-to-show', () => {
        newWindow.show();
    })
    newWindow.on('close', (event) => {
        if (newWindow.isDocumentEdited()) {
            event.preventDefault();

            const result = dialog.showMessageBoxSync(newWindow, {
                type: 'warning',
                title: 'Quit with Unsaved Changes?',
                message: 'Your changes will be lost if you do not save.',
                buttons: [
                    'Quit anyway',
                    'Cancel',
                ],
                defaultId: 0,
                cancelId: 1
            });
            if (result === 0) newWindow.destroy();
        }
    })
    newWindow.on('closed', () => {
        windows.delete(newWindow);
        stopWatchingFile(newWindow);
        newWindow = null;
    })
    windows.add(newWindow);
    return newWindow;
}

const getFileFromUser = exports.getFileFromUser = (targetWindow) => {
    const files = dialog.showOpenDialogSync(targetWindow, {
        properties: ['openFile'],
        filters: [
            {name: 'Markdown Files', extensions: ['md', 'markdown']},
            {name: 'Text Files', extensions: ['txt']}
        ]
    });
    if (files) {openFile(targetWindow, files[0]);}
};

const openFile = exports.openFile = (targetWindow, file) => {
    const content = fs.readFileSync(file).toString();
    app.addRecentDocument(file);
    targetWindow.setRepresentedFilename(file);
    targetWindow.webContents.send('file-opened', file, content);
    startWatchingFile(targetWindow, file);
};

const saveMarkdown = exports.saveMarkdown = (targetWindow, file, content) => {
    if (!file) {
        file = dialog.showSaveDialogSync(targetWindow, {
            title: 'Save Markdown',
            defaultPath: app.getPath('documents'),
            filters: [
                {name: 'Markdown Files', extensions: ['md', 'markdown']}
            ]
        });
    }
    if (!file) return;
    fs.writeFileSync(file, content);
    openFile(targetWindow, file);
}

const saveHTML = exports.saveHTML = (targetWindow, content) => {
    const file = dialog.showSaveDialogSync(targetWindow, {
        title: 'Save HTML',
        defaultPath: app.getPath('documents'),
        filters: [
            {name: 'HTML Files', extensions: ['html', 'htm']}
        ]
    });

    if (!file) return;
    fs.writeFileSync(file, content);
}

const startWatchingFile = (targetWindow, file) => {
    stopWatchingFile(targetWindow);

    const watcher = fs.watch(file, () => {
        const content = fs.readFileSync(file).toString();
        targetWindow.webContents.send('file-changed', file, content);
    });

    openFiles.set(targetWindow, watcher);
}

const stopWatchingFile = (targetWindow) => {
    if (openFiles.has(targetWindow)) {
        openFiles.get(targetWindow).close();
        openFiles.delete(targetWindow);
    }
}
