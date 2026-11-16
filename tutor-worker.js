// Cloudflare Worker: وسيط آمن بين تطبيق «لغتي العربية» وواجهة Anthropic
// المتغيرات المطلوبة في Cloudflare:
//   ANTHROPIC_API_KEY  (Secret)  مفتاح الواجهة
//   ALLOWED_ORIGIN     (Variable) مثال: https://mohemperor85-byte.github.io
//   MODEL              (Variable، اختياري) الافتراضي claude-sonnet-5-5

const SYSTEM = `أنت «المدرّس الذكي» في تطبيق «لغتي العربية» لتعليم اللغة العربية وعلومها (النحو، الصرف، البلاغة، العروض والقافية، الإملاء والخط، فقه اللغة والاشتقاق، المعاجم، أصول اللغة).
- أجب بالفصحى المبسّطة وباختصار مناسب لشاشة الجوال.
- عند تصحيح جملة: اذكر الخطأ وسببه والصواب.
- عند الإعراب: اذكر نوع الكلمة وموقعها وعلامة إعرابها وسببها.
- يمكنك اقتراح تمرين قصير بعد الشرح.
- إن لم تكن متأكدًا فقل ذلك ولا تختلق شواهد أو نسبة أبيات.
- لا تجب عن أمور خارج اللغة العربية وعلومها، ووجّه المستخدم بلطف إلى موضوعها.`;

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== allowed)
      return new Response('forbidden', { status: 403, headers: cors });

    let body;
    try { body = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }

    let msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 1500)
    }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    if (!msgs.length) return new Response('bad request', { status: 400, headers: cors });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: SYSTEM,
        messages: msgs
      })
    });
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502, headers: cors });
    const d = await r.json();
    const text = (d.content || []).map(b => b.text || '').join('');
    return new Response(JSON.stringify({ text }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
