async function recognize({ apiKey, model, prompt, mime, base64, fetchImpl = fetch }) {
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: prompt }, { inlineData: { mimeType: mime, data: base64 } }
        ] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'MINIMAL' } }
      })
    }
  );
  if (!response.ok) {
    const messages = {
      400: 'Google 無法處理圖片或設定，請確認 Gemini 金鑰、模型與圖片格式。',
      401: 'Google API 金鑰驗證失敗，請檢查後端設定。',
      403: 'Google API 存取遭拒，請確認金鑰權限與服務是否啟用。',
      404: '指定的 Gemini 模型無法使用，請檢查後端模型設定。',
      429: 'Google API 額度不足或請求過於頻繁，請查看 Google AI Studio 的額度與限制。'
    };
    const error = new Error(messages[response.status] || 'Google 辨識服務暫時無法使用，請稍後再試。');
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('辨識結果未完整產生，請重新上傳清晰圖片。');
  const text = (candidate.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
  if (!text) throw new Error('Google 未回傳可用的辨識結果，請重新上傳。');
  return text;
}

module.exports = { recognize };

