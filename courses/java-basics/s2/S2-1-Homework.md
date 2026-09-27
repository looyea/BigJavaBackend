# 作业题 · 泛型与类型擦除

> 不判分，对照参考要点自查。

## 作业 1：擦除观测（必做）

写 `List<String>` 与 `List<Integer>` 各一个，`add` 正确类型元素，再用反射 `list.getClass()` 打印两者的运行时类，并 `((List)strList).add(1)`（raw 强转）塞进 Integer 观察编译无警告、取出时 `ClassCastException`。结论：泛型只防"编译期手滑"，运行期裸奔。

## 作业 2：PECS 改写（必做，本节核心）

给下面方法补通配符使其对子/父类型都可用，并说明每个位置用 `extends` 还是 `super`：

1. `static double sum(Collection<?___ Number> c)`（只读）
2. `static void addOnes(Collection<?___ Integer> c)`（只写）
3. `static <T> void copy(List<?___ T> dest, List<?___ T> src)`
4. 排序工具 `sort(List<T> l, Comparator<?___ T> cmp)`

**参考要点**：1 extends，2 super，3 dest=super/src=extends，4 super（比较器消费 T）。

## 作业 3：绕开 `new T()`（必做）

实现 `public static <T> T newInstance(Class<T> type)`，用 `type.getDeclaredConstructor().newInstance()`；再实现一个超类型令牌 `abstract class TypeRef<T>{ TypeRef(){ ((ParameterizedType)getClass().getGenericSuperclass()).getActualTypeArguments()[0]; } }`，打印 `new TypeRef<List<String>>(){}` 捕获到的完整泛型类型。

## 作业 4：泛型数组限制（选做）

尝试 `new ArrayList<String>[10]` 观察编译错误，写出两种替代（`List<List<String>>`、`(List<String>[])new List[10]` + `@SuppressWarnings("unchecked")`），并说明为什么"数组协变 + 泛型擦除"组合会导致运行期 `ArrayStoreException` 而无法在编译期保护。

## 作业 5：桥方法观察（选做）

写 `class Box<T>{ T get(); void set(T); }` 与 `class IntBox extends Box<Integer>`，`javap -c IntBox` 找出编译器生成的**桥方法** `set(Object)`/`get()Object`，说明它如何把擦除后的签名与具体签名衔接起来（呼应 s1-1 vtable）。
