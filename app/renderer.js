const path = require('path')
const marked = require('marked');
const {ipcRenderer} = require('electron');
// require('@electron/remote/main').enable(WebContents);
const remote = require('@electron/remote');

const mainProcess = remote.require('./main');
const currentWindow = remote.getCurrentWindow();

const markdownView = document.querySelector('#markdown');
const htmlView = document.querySelector('#html');
const newFileButton = document.querySelector('#new-file');
const openFileButton = document.querySelector('#open-file');
const saveMarkdownButton = document.querySelector('#save-markdown');
const revertButton = document.querySelector('#revert');
const saveHTMLButton = document.querySelector('#save-html');
const showFileButton = document.querySelector('#show-file');
const openInDefaultButton = document.querySelector('#open-in-default');

let filePath = null;
let originalContent = '';

const isDifferentContent = (content) => content !== markdownView.value;

const renderMarkdownToHTML = (markdown) => {
    htmlView.innerHTML = marked.parse(markdown);
}

const renderFile = (file, content) => {
    filePath = file;
    originalContent = content;
    markdownView.value = content;
    renderMarkdownToHTML(content);
    updateUserInterface(false);
}

const updateUserInterface = (isEdited) => {
    let title = 'Aropyt';
    if (filePath) {title = `${path.basename(filePath)} - ${title}`;}
    if (isEdited) {title = `${title} (Edited)`;}
    currentWindow.setTitle(title);
    currentWindow.setDocumentEdited(isEdited);

    saveMarkdownButton.disabled = !isEdited;
    revertButton.disabled = !isEdited;
}

markdownView.addEventListener('keyup', (event) => {
    const currentContent = event.target.value;
    renderMarkdownToHTML(currentContent);
    updateUserInterface(currentContent !== originalContent);
})

newFileButton.addEventListener('click', () => {
    mainProcess.createWindow();
})

openFileButton.addEventListener('click', () => {
    console.log(mainProcess);
    mainProcess.getFileFromUser(currentWindow);
})

saveHTMLButton.addEventListener('click', () => {
    mainProcess.saveHTML(currentWindow, htmlView.innerHTML);
})

saveMarkdownButton.addEventListener('click', () => {
    mainProcess.saveMarkdown(currentWindow, filePath, markdownView.value);
})

revertButton.addEventListener('click', () => {
    markdownView.value = originalContent;
    renderMarkdownToHTML(originalContent);
})

markdownView.addEventListener('dragover', (event) => {
    const file = getDraggedFile(event);
    if (fileTypeIsSupported(file)) {
        markdownView.classList.add('drag-over');
    } else {
        markdownView.classList.add('drag-error');
    }
})

markdownView.addEventListener('dragleave', () => {
    markdownView.classList.remove('drag-over');
    markdownView.classList.remove('drag-error');
})

markdownView.addEventListener('drop', (event) => {
    const file = getDroppedFile(event);
    if (fileTypeIsSupported(file)) {
        mainProcess.openFile(currentWindow, file.path);
    } else {
        alert('That file type is not supported');
    }
    markdownView.classList.remove('drag-over');
    markdownView.classList.remove('drag-error');
})

document.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('dragleave', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

const getDraggedFile = (event) => event.dataTransfer.items[0];
const getDroppedFile = (event) => event.dataTransfer.files[0];
const fileTypeIsSupported = (file) => {
    return ['text/plain', 'text/markdown', ''].includes(file.type);
}

ipcRenderer.on('file-opened', (event, file, content) => {
    if (currentWindow.isDocumentEdited() && isDifferentContent((content))) {
        const result = remote.dialog.showMessageBoxSync(currentWindow, {
            type: 'warning',
            title: 'Overwrite Current Unsaved Changes?',
            message: 'Opening a new file in this window will overwrite your unsaved changes. Open this file anyway?',
            buttons: [
                'Yes',
                'Cancel',
            ],
            defaultId: 0,
            cancelId: 1
        })

        if (result === 1) {return;}
    }
    renderFile(file, content);
})

ipcRenderer.on('file-changed', (event, file, content) => {
    if (!isDifferentContent(content)) return;
    const result = remote.dialog.showMessageBoxSync(currentWindow, {
        type: 'warning',
        title: 'Overwrite Current Unsaved Changes?',
        message: 'Another application has changed this file. Load changes?',
        buttons: [
            'Yes',
            'Cancel',
        ],
        defaultId: 0,
        cancelId: 1
    })

    renderFile(file, content);
})
