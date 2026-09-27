# 课后作业 · 双指针与滑动窗口

> 2 题，一题滑动窗口模板套用，一题快慢指针链表，附验收标准与参考答案。

## 作业 1：无重复字符的最长子串（60分）

**要求**：用滑动窗口模板求字符串中不含重复字符的最长子串长度。

**验收标准**：
- right 扩张入窗，当窗口内出现重复时 left 收缩到把该重复字符移出窗口；每步更新 `ans=max(ans, right-left+1)`。
- 复杂度 O(n)，只用一层 for + 一个 while。

**参考答案要点**：
```java
int longestNoDup(String s){
    Map<Character,Integer> cnt = new HashMap<>();
    int left=0, ans=0;
    for(int right=0; right<s.length(); right++){
        char c=s.charAt(right); cnt.merge(c,1,Integer::sum);
        while(cnt.get(c) > 1){                       // 出现重复，收缩左界直到移走
            cnt.merge(s.charAt(left), -1, Integer::sum); left++;
        }
        ans=Math.max(ans, right-left+1);
    }
    return ans;
}
```
- 变体：用 `Map<Character,Integer> 记录字符最后位置`，`left=Math.max(left, last+1)` 一步跳到重复之后，省掉 while。

## 作业 2：链表环入口 + Floyd 推导（40分）

**要求**：找出链表环的入口节点，并推导"相遇后一指针归头、同速再走为何在入口重逢"。

**验收标准**：
- 快慢指针相遇判有环；给出距离关系证明。
- 空间 O(1)（不用 HashSet）。

**参考答案要点**：
- 设头到入口 a、入口到相遇点 b、环长 c。相遇时 slow 走 d=a+b、fast 走 2d，且 fast 比 slow 多绕 k 圈：2d=d+k·c ⇒ d=k·c ⇒ a=k·c−b。
- 于是一个指针回头、一个留相遇点，同速各走 a 步：头指针走 a 到入口；相遇点指针走 a=k·c−b 相当于绕 k 圈再退 b，也正好停在入口。
- 代码：先快慢相遇，再 `p=head; while(p!=q){p=p.next;q=q.next;} return p;`。
