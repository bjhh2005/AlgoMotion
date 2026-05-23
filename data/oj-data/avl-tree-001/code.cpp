#include <bits/stdc++.h>
using namespace std;
#define il inline
typedef pair <int, int> pii;

const int N = 2e5 + 11;
int n;
int ls[N], rs[N], rnd[N], siz[N], fa[N], val[N];
int rt, cnt;

il void pushup(int x){
    siz[x] = siz[ls[x]] + siz[rs[x]] + 1;
}

il int nd(int v){
    val[++cnt] = v;
    siz[cnt] = 1;
    rnd[cnt] = rand();
    return cnt;
}

int merge(int x, int y){
    if(!x || !y) return x | y;
    if(rnd[x] < rnd[y]){
        rs[x] = merge(rs[x], y);
        pushup(x);
        return x;
    }else{
        ls[y] = merge(x, ls[y]);
        pushup(y);
        return y;
    }
}

pii split(int x, int v){
    if(!x) return {0, 0};
    if(val[x] <= v){
        auto p = split(rs[x], v);
        rs[x] = p.first;
        pushup(x);
        return {x, p.second};
    }else{
        auto p = split(ls[x], v);
        ls[x] = p.second;
        pushup(x);
        return {p.first, x};
    }
}

void insert(int v){
    auto p = split(rt, v);
    rt = merge(p.first, merge(nd(v), p.second));
}

void del(int v){
    auto p = split(rt, v), q = split(p.first, v - 1);
    q.second = merge(ls[q.second], rs[q.second]);
    rt = merge(q.first, merge(q.second, p.second));
}

int Rank(int v){
    auto p = split(rt, v - 1);
    int ans = siz[p.first] + 1;
    rt = merge(p.first, p.second);
    return ans;
}

int num(int x, int k){
    if(siz[ls[x]] + 1 == k) return val[x];
    if(siz[ls[x]] + 1 > k) return num(ls[x], k);
    return num(rs[x], k - siz[ls[x]] - 1);
}

int pre(int v){
    auto p = split(rt, v - 1);
    int x = p.first;
    while(rs[x]) x = rs[x];
    rt = merge(p.first, p.second);
    return val[x];
}

int sub(int v){
    auto p = split(rt, v);
    int x = p.second;
    while(ls[x]) x = ls[x];
    rt = merge(p.first, p.second);
    return val[x];
}

int main(){
    ios::sync_with_stdio(0);
    cin.tie(0), cout.tie(0);
    // ifstream cin("1.in");
    cin >> n;
    int op, x;
    for(int i = 1; i <= n; i++){
        cin >> op >> x;
        if(op == 1) insert(x);
        if(op == 2) del(x);
        if(op == 3) cout << Rank(x) << '\n';
        if(op == 4) cout << num(rt, x) << '\n';
        if(op == 5) cout << pre(x) << '\n';
        if(op == 6) cout << sub(x) << '\n';
    }
    return 0;
}