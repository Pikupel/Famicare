document.getElementById('form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = document.getElementById('form');
  const result = document.getElementById('result');
  result.textContent = 'İşlem yapılıyor...';
  try {
    const response = await fetch('/api/v1/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: document.getElementById('phone').value,
        pin: document.getElementById('pin').value,
        confirmation: document.getElementById('confirmation').value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Hesap silinemedi');
    form.reset();
    form.remove();
    result.textContent = 'Hesabınız ve ilişkili uygulama verileriniz silindi.';
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : 'Hesap silinemedi';
  }
});
