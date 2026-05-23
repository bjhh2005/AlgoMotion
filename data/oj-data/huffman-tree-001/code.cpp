#include <bits/stdc++.h>
using namespace std;
#define ll long long

const int N = 1e5 + 11;
int n, k;
ll a[N];
struct Node{
    ll w, h;
    bool operator< (const Node x) const{
        if(w == x.w) return h > x.h;
        return w > x.w;
    }
};
priority_queue <Node> q;

int main(){
    cin >> n >> k;
    for(int i = 1; i <= n; i++){
        cin >> a[i];
        q.push((Node){a[i], 1});
    }
    ll ans = 0;
    while((q.size() - 1) % (k - 1) != 0) q.push((Node){0, 1});
    while(q.size() >= k){
        ll w = 0, h = 0;
        for(int i = 1; i <= k; i++){
            auto t = q.top();
            q.pop();
            h = max(h, t.h);
            w += t.w;
        }
        ans += w;
        q.push((Node){w, h + 1});
    }
    cout << ans << '\n' << q.top().h - 1;
    return 0;
}