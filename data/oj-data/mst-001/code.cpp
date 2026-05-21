#include <bits/stdc++.h>
using namespace std;

const int inf = 2147483647;
int n, m;
typedef pair <int, int> pii;
vector <pii> v[5050];
int dis[5050], vis[5050];
priority_queue <pii, vector <pii>, greater <pii>> q;

int prim(){
    for(int i = 2; i <= n; i++){
        dis[i] = inf;
    }
    q.push({0, 1});
    int cnt = 0, ans = 0;
    while(!q.empty()){
        if(cnt >= n) break;
        auto p = q.top();
        q.pop();
        if(vis[p.second]) continue;
        vis[p.second] = 1;
        ans += p.first;
        cnt++;
        for(auto l : v[p.second]){
            if(l.second < dis[l.first]){
                dis[l.first] = l.second;
                q.push({dis[l.first], l.first});
            }
        }
    }
    if(cnt != n) return -1;
    return ans;
}

int main(){
    cin >> n >> m;
    int x, y, z;
    for(int i = 1; i <= m; i++){
        cin >> x >> y >> z;
        v[x].push_back({y, z});
        v[y].push_back({x, z});
    }
    int ans = prim();
    if(ans == -1) cout << "orz";
    else cout << ans;
    return 0;
}