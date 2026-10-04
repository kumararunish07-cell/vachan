const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const modal = $('#modalBackdrop');
const toast = $('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function openModal() { modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => modal.querySelector('input')?.focus(), 30); }
function closeModal() { modal.hidden = true; document.body.style.overflow = ''; }
$('#newDealButton').addEventListener('click', openModal);
$('#workspaceNewButton').addEventListener('click', openModal);
$('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

$('#dealForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const title = data.get('title');
  const client = data.get('client');
  const amount = Number(data.get('amount')).toLocaleString('en-IN');
  const item = document.createElement('button');
  item.className = 'agreement-item selected';
  item.dataset.title = title;
  item.dataset.value = `₹${amount}`;
  item.dataset.client = client;
  item.dataset.due = '7 days';
  item.innerHTML = `<span class="list-icon purple">✦</span><span><b>${title}</b><small>${client} · ₹${amount}</small></span><span class="list-status review">Draft</span>`;
  $$('.agreement-item').forEach((entry) => entry.classList.remove('selected'));
  $('#agreementList').prepend(item);
  bindAgreement(item);
  $('#agreementCount').textContent = `${$$('.agreement-item').length} active records`;
  item.click();
  event.target.reset();
  closeModal();
  showToast('Agreement created in demo mode.');
  document.querySelector('#activity').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function bindAgreement(item) {
  item.addEventListener('click', () => {
    $$('.agreement-item').forEach((entry) => entry.classList.remove('selected'));
    item.classList.add('selected');
    $('#selectedTitle').textContent = item.dataset.title;
    $('#selectedValue').textContent = item.dataset.value;
    $('#selectedClient').textContent = item.dataset.client;
    $('#selectedDue').textContent = item.dataset.due;
    $('#selectedStatus').innerHTML = '<span></span> Review window';
    $('#selectedStatus').style.color = 'var(--orange)';
    resetTimeline();
  });
}
$$('.agreement-item').forEach(bindAgreement);

function resetTimeline() {
  $('#timeline').innerHTML = `<div class="event complete"><span class="event-dot">✓</span><div><b>Agreement created</b><small>Scope locked by Arunish · just now</small></div></div><div class="event current"><span class="event-dot">2</span><div><b>Payment intent ready</b><small>Open the UPI intent when the client is ready</small></div></div><div class="event"><span class="event-dot">3</span><div><b>Proof submitted</b><small>Waiting for a deployment link or work evidence</small></div></div><div class="event"><span class="event-dot">4</span><div><b>Client review window</b><small>Accept or dispute after proof is submitted</small></div></div>`;
}

$('#acceptButton').addEventListener('click', () => {
  $('#selectedStatus').innerHTML = '<span></span> Accepted';
  $('#selectedStatus').style.color = 'var(--mint)';
  $('#timeline').innerHTML = `<div class="event complete"><span class="event-dot">✓</span><div><b>Agreement created</b><small>Scope and value locked</small></div></div><div class="event complete"><span class="event-dot">✓</span><div><b>Payment confirmed</b><small>UPI event verified in demo ledger</small></div></div><div class="event complete"><span class="event-dot">✓</span><div><b>Proof accepted</b><small>Client approved the submitted evidence</small></div></div><div class="event complete"><span class="event-dot">✓</span><div><b>Milestone closed</b><small>Receipt is ready to export</small></div></div>`;
  showToast('Milestone accepted. Receipt is ready to export.');
});
$('#disputeButton').addEventListener('click', () => {
  $('#selectedStatus').innerHTML = '<span></span> Dispute opened';
  $('#selectedStatus').style.color = 'var(--red)';
  showToast('Demo dispute opened. Both parties would now add evidence.');
});
$('#receiptButton').addEventListener('click', () => {
  const text = `VACHAN RECEIPT\n\nAgreement: ${$('#selectedTitle').textContent}\nClient: ${$('#selectedClient').textContent}\nValue: ${$('#selectedValue').textContent}\nStatus: ${$('#selectedStatus').textContent.trim()}\n\nThis is a demo receipt. Vachan does not hold funds.`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'vachan-receipt.txt'; link.click(); URL.revokeObjectURL(url);
  showToast('Receipt exported.');
});
$('#filterButton').addEventListener('click', () => showToast('Filter view: all agreements')); 
$('#languageToggle').addEventListener('click', () => {
  const button = $('#languageToggle');
  const current = button.firstChild.textContent.trim();
  button.firstChild.textContent = current === 'EN' ? 'हि ' : current === 'हि' ? 'বাং ' : 'EN ';
  showToast(current === 'EN' ? 'Hindi surface preview selected.' : current === 'हि' ? 'Bengali surface preview selected.' : 'English surface selected.');
});
