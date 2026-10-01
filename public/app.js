const singleForm = document.querySelector('#single-form');
const singleNotice = document.querySelector('#single-notice');
const bulkForm = document.querySelector('#bulk-form');
const bulkNotice = document.querySelector('#bulk-notice');
const fileInput = document.querySelector('#csv-file');
const fileLabel = document.querySelector('#file-label');
const searchInput = document.querySelector('#search');
let searchTimer;
let currentPage = 0;
let shownEntries = 0;

function showNotice(element, message, kind = 'success', errors = []) {
  element.className = `notice visible ${kind}`;
  element.replaceChildren(document.createTextNode(message));
  if (errors.length) {
    const list = document.createElement('ul');
    for (const issue of errors.slice(0, 8)) {
      const item = document.createElement('li');
      item.textContent = `${issue.row ? `Row ${issue.row} · ` : ''}${issue.field}: ${issue.message}`;
      list.append(item);
    }
    element.append(list);
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
}

async function loadCards(search = '', page = 0, append = false) {
  const body = document.querySelector('#cards-body');
  const moreButton = document.querySelector('#load-more');
  try {
    const data = await requestJson(`/api/cards?search=${encodeURIComponent(search)}&page=${page}`);
    document.querySelector('#unique-count').textContent = Number(data.summary.count).toLocaleString();
    document.querySelector('#copy-count').textContent = Number(data.summary.copies).toLocaleString();
    currentPage = page;
    if (!append) shownEntries = 0;
    shownEntries += data.cards.length;
    document.querySelector('#table-count').textContent = `${shownEntries.toLocaleString()} ${shownEntries === 1 ? 'entry' : 'entries'} shown`;
    if (!append) body.replaceChildren();
    moreButton.hidden = data.cards.length < data.pageSize;
    if (!data.cards.length) {
      if (append) return;
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.className = 'empty';
      cell.textContent = search ? 'No cards match that search.' : 'Your collection is ready. Add a card above to get started.';
      return;
    }
    for (const card of data.cards) {
      const row = body.insertRow();
      const name = row.insertCell();
      const title = document.createElement('div');
      title.className = 'card-name';
      title.textContent = card.name;
      const set = document.createElement('div');
      set.className = 'set-name';
      set.textContent = card.setName;
      name.append(title, set);
      row.insertCell().textContent = card.setCode;
      row.insertCell().textContent = card.collectorNumber;
      const finish = row.insertCell();
      const finishBadge = document.createElement('span');
      finishBadge.className = 'pill';
      finishBadge.textContent = card.finish;
      finish.append(finishBadge);
      const condition = row.insertCell();
      const conditionBadge = document.createElement('span');
      conditionBadge.className = 'pill';
      conditionBadge.textContent = card.condition;
      condition.append(conditionBadge);
      const quantity = row.insertCell();
      quantity.className = 'qty';
      quantity.textContent = card.quantity.toLocaleString();
    }
  } catch {
    body.replaceChildren();
    moreButton.hidden = true;
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.className = 'empty';
    cell.textContent = 'Could not load the collection. Refresh to try again.';
  }
}

singleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = singleForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const card = Object.fromEntries(new FormData(singleForm).entries());
  try {
    const result = await requestJson('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
    showNotice(singleNotice, result.message);
    singleForm.reset();
    await loadCards(searchInput.value);
  } catch (error) {
    showNotice(singleNotice, error.error || 'Could not save this card.', 'error', error.errors || []);
  } finally {
    button.disabled = false;
  }
});

fileInput.addEventListener('change', () => {
  fileLabel.textContent = fileInput.files[0]?.name || 'Choose a CSV file';
});

const dropZone = document.querySelector('.upload-zone');
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  if (event.dataTransfer.files[0]) {
    fileInput.files = event.dataTransfer.files;
    fileLabel.textContent = fileInput.files[0].name;
  }
});

bulkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return showNotice(bulkNotice, 'Choose a CSV file to import.', 'error');
  const button = bulkForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await requestJson('/api/cards/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: await file.text() });
    showNotice(bulkNotice, `${result.imported.toLocaleString()} rows imported. ${result.message}`);
    bulkForm.reset();
    fileLabel.textContent = 'Choose a CSV file';
    await loadCards(searchInput.value);
  } catch (error) {
    showNotice(bulkNotice, error.error || 'Could not import this file.', 'error', error.errors || []);
  } finally {
    button.disabled = false;
  }
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCards(searchInput.value), 180);
});

document.querySelector('#load-more').addEventListener('click', () => loadCards(searchInput.value, currentPage + 1, true));

loadCards();
