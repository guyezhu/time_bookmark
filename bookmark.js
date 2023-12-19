let currentSortOrder = 'desc'; // 全局变量，保存当前排序方式

document.addEventListener('DOMContentLoaded', function () {
    loadBookmarkFolders();
    setupSortButtons();
    sortBookmarks('desc'); // 页面加载时默认倒序排序
});

// 加载书签文件夹到下拉菜单
function loadBookmarkFolders() {
    chrome.bookmarks.getTree(function (nodes) {
        const folderSelect = document.getElementById('folderSelect');
        folderSelect.innerHTML = ''; // 清空现有选项
        findFolders(nodes, folderSelect);
    });
}

// 递归查找书签文件夹，只添加直接包含书签的文件夹
function findFolders(nodes, selectElement, indentation = '') {
    nodes.forEach(function (node) {
        // 忽略非文件夹节点
        if (!node.children) {
            return;
        }
        // 检查该文件夹是否直接包含书签
        let containsBookmarks = node.children.some(child => 'url' in child);
        // 如果文件夹直接包含书签，则添加到下拉菜单
        if (containsBookmarks) {
            const opt = document.createElement('option');
            opt.value = node.id;
            opt.textContent = indentation + node.title;
            selectElement.appendChild(opt);
        }
        // 如果该节点是文件夹，继续递归其子节点
        if (node.children.length) {
            findFolders(node.children, selectElement, indentation + '-');
        }
    });
}

// 选中文件夹时的操作
document.getElementById('folderSelect').addEventListener('change', function (event) {
    displayBookmarks(event.target.value);
});


// 按钮：时间从新到旧排序
document.getElementById('sortAsc').addEventListener('click', function () {
    sortBookmarks(true);
});

// 按钮：时间从旧到新排序
document.getElementById('sortDesc').addEventListener('click', function () {
    sortBookmarks(false);
});

// 设置排序按钮的事件监听器
function setupSortButtons() {
    document.getElementById('sortAsc').addEventListener('click', function () {
        currentSortOrder = 'asc';
        sortCurrentFolder();
    });

    document.getElementById('sortDesc').addEventListener('click', function () {
        currentSortOrder = 'desc';
        sortCurrentFolder();
    });
}

// 选择文件夹时调用的函数
function displayBookmarks(folderId) {
    chrome.bookmarks.getChildren(folderId, function (bookmarks) {
        // ...获取书签并显示...
        sortCurrentFolder(); // 应用当前排序方式
    });
}

// 对当前文件夹应用排序
function sortCurrentFolder() {
    const folderId = document.getElementById('folderSelect').value;
    chrome.bookmarks.getChildren(folderId, function (bookmarks) {
        const ascending = currentSortOrder === 'asc';
        sortBookmarks(ascending, bookmarks);
    });
}

// 排序函数，增加bookmarks参数
function sortBookmarks(ascending, bookmarks) {
    bookmarks.sort(function (a, b) {
        return ascending ? a.dateAdded - b.dateAdded : b.dateAdded - a.dateAdded;
    });
    displaySortedBookmarks(bookmarks);
}

// 显示排序后的书签（包括格式化时间、图标、书签名、网址和删除按钮）
function displaySortedBookmarks(bookmarks) {
    const bookmarksList = document.getElementById('bookmarksList');
    bookmarksList.innerHTML = ''; // 清空列表

    bookmarks.forEach(function (bookmark) {
        if (!bookmark.url) return; // 忽略文件夹

        const li = document.createElement('li');
        li.className = 'bookmark-item';

        const a = document.createElement('a');
        a.href = bookmark.url;
        a.target = '_blank'; // 在新标签页中打开链接
        a.className = 'bookmark-link';

        // 添加格式化时间
        const timeSpan = document.createElement('span');
        const addedDate = new Date(bookmark.dateAdded);
        timeSpan.textContent = formatDate(addedDate);
        timeSpan.className = 'bookmark-time';

        // 添加网站图标
        const favicon = document.createElement('img');
        favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}`;
        favicon.className = 'favicon';
        favicon.onerror = function () { this.style.display = 'none'; };

        // 添加书签名
        const titleSpan = document.createElement('span');
        titleSpan.textContent = bookmark.title;
        titleSpan.className = 'bookmark-title';

        // 添加网址
        const urlSpan = document.createElement('span');
        urlSpan.textContent = bookmark.url;
        urlSpan.className = 'bookmark-url';

        a.appendChild(timeSpan);
        a.appendChild(favicon);
        a.appendChild(titleSpan);
        a.appendChild(urlSpan);
        li.appendChild(a);

        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = function (e) {
            e.preventDefault(); // 阻止链接跳转
            e.stopPropagation(); // 阻止事件冒泡
            deleteBookmark(bookmark.id, li); // 调用 deleteBookmark 函数
        };
        li.appendChild(deleteBtn);

        bookmarksList.appendChild(li);
    });
}



// 格式化时间日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，所以+1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
}

let lastDeletedBookmark = null;

function deleteBookmark(bookmarkId, liElement) {
    chrome.bookmarks.get(bookmarkId, function (results) {
        lastDeletedBookmark = results[0]; // 保存被删除的书签信息
        chrome.bookmarks.remove(bookmarkId, function () {
            liElement.remove(); // 从列表中移除
            document.getElementById('undoButton').style.display = 'block'; // 显示撤销按钮
        });
    });
}

// 撤销删除
document.getElementById('undoButton').addEventListener('click', function () {
    if (lastDeletedBookmark) {
        chrome.bookmarks.create({
            parentId: lastDeletedBookmark.parentId,
            title: lastDeletedBookmark.title,
            url: lastDeletedBookmark.url,
            index: lastDeletedBookmark.index
        }, function () {
            loadBookmarksList(); // 重新加载书签
            document.getElementById('undoButton').style.display = 'none'; // 隐藏撤销按钮
        });
        lastDeletedBookmark = null;
    }
});

// 加载和显示书签列表的函数
function loadBookmarksList() {
    const selectedFolderId = document.getElementById('folderSelect').value;
    if (selectedFolderId) {
        chrome.bookmarks.getChildren(selectedFolderId, function (bookmarks) {
            sortBookmarks(currentSortOrder === 'asc', bookmarks);
        });
    }
}
