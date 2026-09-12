# Greeting Rotation — Backend Spec

**Date:** 2026-06-19
**Status:** ⏳ 待后端实现
**Scope:** Backend (new `greetings` app) + frontend 1-line fetch

## 目标

Dashboard 欢迎语从静态文案改为后端句子库随机轮换。用户每次进入 Dashboard 看到不同的问候语，点击可手动刷新。

## 后端变更（ExoCore/）

### 新建 app: `greetings`

```
ExoCore/greetings/
  __init__.py
  models.py
  serializers.py
  views.py
  urls.py
  apps.py
```

### Model: `Greeting`

```python
from django.db import models

class Greeting(models.Model):
    text       = models.TextField(help_text="问候语文本")
    category   = models.CharField(max_length=50, blank=True, default="", help_text="分类标签（可选，供将来按场景筛选）")
    is_active  = models.BooleanField(default=True, help_text="停用后不会出现在随机结果中")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.text[:60]
```

### Serializer: `GreetingSerializer`

```python
from rest_framework import serializers
from .models import Greeting

class GreetingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Greeting
        fields = ['id', 'text', 'category', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
```

### View: `GET /api/greetings/random/`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Greeting
from .serializers import GreetingSerializer

class RandomGreetingView(APIView):
    """
    GET /api/greetings/random/?category=<optional>
    返回一条随机活跃问候语。
    """
    def get(self, request):
        qs = Greeting.objects.filter(is_active=True)
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        count = qs.count()
        if count == 0:
            return Response({"error": "没有可用的问候语"}, status=status.HTTP_404_NOT_FOUND)
        obj = qs.order_by('?').first()
        return Response(GreetingSerializer(obj).data)
```

### URL 注册

`greetings/urls.py`:
```python
from django.urls import path
from .views import RandomGreetingView

urlpatterns = [
    path('random/', RandomGreetingView.as_view(), name='random-greeting'),
]
```

主 `ExoCore/urls.py` 增加:
```python
path('api/greetings/', include('greetings.urls')),
```

`ExoCore/settings.py` 的 `INSTALLED_APPS` 增加:
```python
'greetings',
```

### Seed Data（初始化）

通过 Django Admin 手动添加，或写一个 data migration。建议首批 ~10 条：

| text |
|------|
| 神经链路已建立，所有核心待命中。 |
| 量子比特已校准，观察者就位。 |
| 记忆索引完整，可随时检索旧日对话。 |
| 今夜适宜沉思，也适宜让 AI 替你写作。 |
| 所有模块自检通过。欢迎回到指挥舱。 |
| 日志显示你上次离开是在午夜。一如既往。 |
| 星辰静默，算力充沛。开始吧。 |
| 每个伟大的工程都始于一句对话。 |
| 信号强度满格，等待指令。 |
| 你不在的时候，系统迭代了 3 个版本。 |

## 前端变更（ExoCore-Desktop/）

`Dashboard.jsx` — 两处修改：

1. **新增 state + fetch：**
```js
const [greeting, setGreeting] = useState('神经链路已建立，所有核心待命中。');

const fetchGreeting = async () => {
  try {
    const res = await fetch(`${baseUrl}/api/greetings/random/`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setGreeting(data.text);
    }
  } catch {} // 失败则保留当前文案
};

useEffect(() => { fetchGreeting(); }, []);
```

2. **副标题替换：**
```jsx
{/* 原来 */}
<p className="tx-subtitle-accent font-light max-w-[420px] leading-relaxed">
  神经链路已建立，所有核心待命中。
</p>

{/* 改为 */}
<p
  className="tx-subtitle-accent font-light max-w-[420px] leading-relaxed cursor-pointer select-none transition-opacity duration-300"
  onClick={fetchGreeting}
>
  {greeting}
</p>
```

点击文案即可换一句。过渡效果用 CSS `opacity` fade 即可（后续可以加 `fadeUp` key 触发动画）。

## API 契约

### `GET /api/greetings/random/`

| | |
|---|---|
| **Query** | `?category=<string>` (可选) |
| **200** | `{ "id": 1, "text": "星辰静默，算力充沛。", "category": "", "is_active": true, "created_at": "..." }` |
| **404** | `{ "error": "没有可用的问候语" }` |

## 不变部分

- Dashboard 其余结构不动
- Agent Hub 不动
- UserProfile 不动
- 不影响任何现有接口

## 验证方式

1. `python.exe manage.py migrate` — greetings 表创建成功
2. Django Admin 手动加几条问候语
3. `curl http://localhost:8000/api/greetings/random/` — 返回随机一条
4. 多次调用 — 结果有变化（不保证不重复，随机即可）
5. `curl http://localhost:8000/api/greetings/random/?category=test` — 无匹配时返回 404
