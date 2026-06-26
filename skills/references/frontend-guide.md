# 前端 / UI 工程指南

共享 reference，多 skill 按需 Read。

构建生产级用户界面：可访问、高性能、视觉精致。目标是让 UI 看起来像顶级公司里一位有设计意识的工程师做出来的——而不是 AI 生成的。这意味着真正遵循设计系统、做好可访问性、有思考的交互模式，以及没有那种泛泛的「AI 美学」。

## Component Architecture（组件架构）

### File Structure（文件结构）

把一个组件相关的所有东西放在一起（colocate）：

```
src/components/
  TaskList/
    TaskList.tsx          # Component implementation
    TaskList.test.tsx     # Tests
    TaskList.stories.tsx  # Storybook stories (if using)
    use-task-list.ts      # Custom hook (if complex state)
    types.ts              # Component-specific types (if needed)
```

### Component Patterns（组件模式）

**组合优于配置（Prefer composition over configuration）：**

```tsx
// Good: Composable
<Card>
  <CardHeader>
    <CardTitle>Tasks</CardTitle>
  </CardHeader>
  <CardBody>
    <TaskList tasks={tasks} />
  </CardBody>
</Card>

// Avoid: Over-configured
<Card
  title="Tasks"
  headerVariant="large"
  bodyPadding="md"
  content={<TaskList tasks={tasks} />}
/>
```

**保持组件聚焦（Keep components focused）：**

```tsx
// Good: Does one thing
export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  return (
    <li className="flex items-center gap-3 p-3">
      <Checkbox checked={task.done} onChange={() => onToggle(task.id)} />
      <span className={task.done ? 'line-through text-muted' : ''}>{task.title}</span>
      <Button variant="ghost" size="sm" onClick={() => onDelete(task.id)}>
        <TrashIcon />
      </Button>
    </li>
  );
}
```

**数据获取与展示分离（Separate data fetching from presentation）——Container/Presentation：**

```tsx
// Container: handles data
export function TaskListContainer() {
  const { tasks, isLoading, error } = useTasks();

  if (isLoading) return <TaskListSkeleton />;
  if (error) return <ErrorState message="Failed to load tasks" retry={refetch} />;
  if (tasks.length === 0) return <EmptyState message="No tasks yet" />;

  return <TaskList tasks={tasks} />;
}

// Presentation: handles rendering
export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul role="list" className="divide-y">
      {tasks.map(task => <TaskItem key={task.id} task={task} />)}
    </ul>
  );
}
```

## State Management（状态管理）

**选择能解决问题的最简方案（Choose the simplest approach that works）：**

```
Local state (useState)           → Component-specific UI state
Lifted state                     → Shared between 2-3 sibling components
Context                          → Theme, auth, locale (read-heavy, write-rare)
URL state (searchParams)         → Filters, pagination, shareable UI state
Server state (React Query, SWR)  → Remote data with caching
Global store (Zustand, Redux)    → Complex client state shared app-wide
```

**避免超过 3 层的 prop drilling（Avoid prop drilling deeper than 3 levels）。** 如果你在把 props 穿过那些根本用不到它们的组件，就引入 context 或重构组件树。

## Design System Adherence（遵循设计系统）

### Avoid the AI Aesthetic（避免 AI 美学）

AI 生成的 UI 有一些可被识别的套路。全部避免：

| AI Default | Why It Is a Problem | Production Quality |
|---|---|---|
| Purple/indigo everything | Models default to visually "safe" palettes, making every app look identical | Use the project's actual color palette |
| Excessive gradients | Gradients add visual noise and clash with most design systems | Flat or subtle gradients matching the design system |
| Rounded everything (rounded-2xl) | Maximum rounding signals "friendly" but ignores the hierarchy of corner radii in real designs | Consistent border-radius from the design system |
| Generic hero sections | Template-driven layout with no connection to the actual content or user need | Content-first layouts |
| Lorem ipsum-style copy | Placeholder text hides layout problems that real content reveals (length, wrapping, overflow) | Realistic placeholder content |
| Oversized padding everywhere | Equal generous padding destroys visual hierarchy and wastes screen space | Consistent spacing scale |
| Stock card grids | Uniform grids are a layout shortcut that ignores information priority and scanning patterns | Purpose-driven layouts |
| Shadow-heavy design | Layered shadows add depth that competes with content and slows rendering on low-end devices | Subtle or no shadows unless the design system specifies |

### Spacing and Layout（间距与布局）

使用一致的 spacing scale。不要凭空发明数值：

```css
/* Use the scale: 0.25rem increments (or whatever the project uses) */
/* Good */  padding: 1rem;      /* 16px */
/* Good */  gap: 0.75rem;       /* 12px */
/* Bad */   padding: 13px;      /* Not on any scale */
/* Bad */   margin-top: 2.3rem; /* Not on any scale */
```

### Typography（排版）

尊重类型层级（type hierarchy）：

```
h1 → Page title (one per page)
h2 → Section title
h3 → Subsection title
body → Default text
small → Secondary/helper text
```

不要跳过标题层级。不要把标题样式用在非标题内容上。

### Color（颜色）

- 使用语义化颜色 token：`text-primary`、`bg-surface`、`border-default`——不要用裸 hex 值
- 保证足够对比度（正文 4.5:1，大字 3:1）
- 不要仅靠颜色传达信息（同时用图标、文字或图案）

## Accessibility（可访问性，WCAG 2.1 AA）

每个组件都必须满足这些标准：

### Keyboard Navigation（键盘导航）

```tsx
// Every interactive element must be keyboard accessible
<button onClick={handleClick}>Click me</button>        // ✓ Focusable by default
<div onClick={handleClick}>Click me</div>               // ✗ Not focusable
<div role="button" tabIndex={0} onClick={handleClick}    // ✓ But prefer <button>
     onKeyDown={e => {
       if (e.key === 'Enter') handleClick();
       if (e.key === ' ') e.preventDefault();
     }}
     onKeyUp={e => {
       if (e.key === ' ') handleClick();
     }}>
  Click me
</div>
```

### ARIA Labels

```tsx
// Label interactive elements that lack visible text
<button aria-label="Close dialog"><XIcon /></button>

// Label form inputs
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Or use aria-label when no visible label exists
<input aria-label="Search tasks" type="search" />
```

### Focus Management（焦点管理）

```tsx
// Move focus when content changes
function Dialog({ isOpen, onClose }: DialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  // Trap focus inside dialog when open
  return (
    <dialog open={isOpen}>
      <button ref={closeRef} onClick={onClose}>Close</button>
      {/* dialog content */}
    </dialog>
  );
}
```

### Meaningful Empty and Error States（有意义的空态与错误态）

```tsx
// Don't show blank screens
function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div role="status" className="text-center py-12">
        <TasksEmptyIcon className="mx-auto h-12 w-12 text-muted" />
        <h3 className="mt-2 text-sm font-medium">No tasks</h3>
        <p className="mt-1 text-sm text-muted">Get started by creating a new task.</p>
        <Button className="mt-4" onClick={onCreateTask}>Create Task</Button>
      </div>
    );
  }

  return <ul role="list">...</ul>;
}
```

## Responsive Design（响应式设计）

移动优先（mobile first），然后向外扩展：

```tsx
// Tailwind: mobile-first responsive
<div className="
  grid grid-cols-1      /* Mobile: single column */
  sm:grid-cols-2        /* Small: 2 columns */
  lg:grid-cols-3        /* Large: 3 columns */
  gap-4
">
```

在这些断点测试：320px、768px、1024px、1440px。

## Loading and Transitions（加载与过渡）

```tsx
// Skeleton loading (not spinners for content)
function TaskListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
      ))}
    </div>
  );
}

// Optimistic updates for perceived speed
function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleTask,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks']);

      queryClient.setQueryData(['tasks'], (old: Task[]) =>
        old.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
      );

      return { previous };
    },
    onError: (_err, _taskId, context) => {
      queryClient.setQueryData(['tasks'], context?.previous);
    },
  });
}
```

## React 实现模式（补充）

> 吸收自 everything-claude-code v1.2.0 frontend-patterns skill (MIT)

上面讲架构与设计原则，这里补几个高频的具体实现模式。库无关，挑能解决问题的最简方案用。

### Compound Components（复合组件）

当一组组件需要共享隐式状态（如 Tabs、Accordion、Select），用 context 把它们绑成一个家族，而不是用一堆 props 把状态层层透传。

```tsx
const TabsContext = createContext<{ active: string; setActive: (id: string) => void } | undefined>(undefined);

export function Tabs({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }) {
  const [active, setActive] = useState(defaultTab);
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}

export function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used within Tabs');  // 越界使用直接报错，而不是静默失败
  return (
    <button className={ctx.active === id ? 'active' : ''} onClick={() => ctx.setActive(id)}>
      {children}
    </button>
  );
}

// <Tabs defaultTab="overview"><Tab id="overview">Overview</Tab><Tab id="details">Details</Tab></Tabs>
```

要点：子组件用 `useContext` 取状态，缺失 Provider 时抛错——这把"用错地方"变成立刻可见的失败，而不是难查的 bug。

### Context + Reducer（中等复杂度状态）

状态有多个相关字段、转移逻辑复杂时，用 reducer 把"怎么变"集中到一处，比散落的 `useState` setter 更好维护。这是介于 `useState` 和外部 store（Zustand/Redux）之间的中间档。

```tsx
type Action =
  | { type: 'SET_ITEMS'; payload: Item[] }
  | { type: 'SELECT'; payload: Item }
  | { type: 'SET_LOADING'; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ITEMS':   return { ...state, items: action.payload };
    case 'SELECT':      return { ...state, selected: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    default:            return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | undefined>(undefined);

export function Provider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], selected: null, loading: false });
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
```

什么时候升级到外部 store：跨大半个应用共享、写操作频繁、需要中间件（持久化/日志）时。在那之前 Context + Reducer 够用且零依赖。

### Error Boundary（错误边界）

React 组件树里任何一处渲染抛错，默认会让整棵树白屏。用 Error Boundary 把错误圈在局部，给出可恢复的兜底 UI。

```tsx
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 上报到错误监控（Sentry 等）
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert">
          <h2>出错了</h2>
          <button onClick={() => this.setState({ hasError: false, error: null })}>重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

放置策略：包在路由级、或包在"可能失败但不该拖垮全页"的局部（如某个第三方 widget、某个数据面板）。Error Boundary 只能用 class 组件实现——这是少数还必须用 class 的场景。注意它抓不到事件处理器、异步代码、SSR 里的错误。

### Debounce Hook（输入去抖）

搜索框、自动保存等"输入变化频繁但下游操作昂贵"的场景，用去抖把高频变化压成低频触发。

```tsx
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);  // 每次 value 变都清掉上一个待触发的 timer
  }, [value, delay]);
  return debounced;
}

// const debouncedQuery = useDebounce(query, 500);
// useEffect(() => { if (debouncedQuery) search(debouncedQuery); }, [debouncedQuery]);
```

关键是 cleanup 里 `clearTimeout`——没有它，每次输入都会留下一个迟早触发的 timer，去抖就失效了。

### 长列表虚拟化（Virtualization）

渲染几百上千行时，DOM 节点数会拖垮性能。虚拟化只渲染视口内可见的行 + 少量缓冲，滚动时动态替换。

- 触发条件：列表项 > 数百，且每项有一定渲染成本。几十项不必虚拟化（增加复杂度不划算）。
- 实现：用成熟库（如 `@tanstack/react-virtual`、`react-window`），不要自己手写——边界情况（动态行高、滚动恢复、a11y）很多。
- 取舍：虚拟化会牺牲浏览器原生的 Ctrl+F 搜索、锚点跳转。列表需要这些能力时要额外处理。

## Common Rationalizations（常见自我合理化）

| Rationalization | Reality |
|---|---|
| "Accessibility is a nice-to-have" | It's a legal requirement in many jurisdictions and an engineering quality standard. |
| "We'll make it responsive later" | Retrofitting responsive design is 3x harder than building it from the start. |
| "The design isn't final, so I'll skip styling" | Use the design system defaults. Unstyled UI creates a broken first impression for reviewers. |
| "This is just a prototype" | Prototypes become production code. Build the foundation right. |
| "The AI aesthetic is fine for now" | It signals low quality. Use the project's actual design system from the start. |

## Red Flags（危险信号）

- 超过 200 行的组件（拆分它们）
- 内联样式或任意 px 值
- 缺失错误态、加载态或空态
- 没有做键盘导航测试
- 颜色作为状态的唯一指示（红/绿没有文字或图标）
- 泛泛的「AI 观感」（紫色渐变、超大卡片、套模板布局）

## Verification（验证清单）

构建 UI 之后：

- [ ] Component renders without console errors
- [ ] All interactive elements are keyboard accessible (Tab through the page)
- [ ] Screen reader can convey the page's content and structure
- [ ] Responsive: works at 320px, 768px, 1024px, 1440px
- [ ] Loading, error, and empty states all handled
- [ ] Follows the project's design system (spacing, colors, typography)
- [ ] No accessibility warnings in dev tools or axe-core
