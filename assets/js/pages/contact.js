// ---- お問い合わせフォーム ----
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const thanks = document.getElementById('thanks');
const button = form.querySelector('.send');
const ERRORS = {
  empty: '内容を書いてください',
  email: 'メールアドレスの形を確かめてください',
  'too-long': '内容が長すぎます (3000文字まで)',
  rate: '続けて送れません。少し時間をおいてから送ってください',
  captcha: '確認がうまくいきませんでした。もう一度送ってください',
  config: '今は送れません。ほかの連絡先からお願いします',
};
const say = (text, isError) => {
  status.textContent = text;
  status.classList.toggle('error', !!isError);
};

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.message.trim()) return say(ERRORS.empty, true);
  if (data.email && !form.elements.email.checkValidity()) return say(ERRORS.email, true);

  button.disabled = true;
  say('送信中');
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || res.status);
    form.hidden = true;
    thanks.hidden = false;
  } catch (err) {
    say(ERRORS[err.message] || '送れませんでした。時間をおいてもう一度試してください', true);
    window.turnstile?.reset(); // 人間確認は1回きりなので、次の送信用に取り直す
    button.disabled = false;
  }
});
