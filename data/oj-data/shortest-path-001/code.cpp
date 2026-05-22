#include <bits/stdc++.h>
using namespace std;
typedef pair <int, int> pii;

const int N = 1e5 + 11;
const int inf = 2147483647;
int n, m, s;
vector <pii> v[N];
int dis[N], vis[N];
priority_queue <pii, vector <pii>, greater <pii>> q;

void dijkstra(int s){
    for(int i = 1; i <= n; i++){
        if(i != s){
            dis[i] = inf;
            q.push({dis[i], i});
        }else{
            q.push({0, s});
        }
    }
    while(!q.empty()){
        auto p = q.top();
        q.pop();
        if(vis[p.second]) continue;
        vis[p.second] = 1;
        for(auto l : v[p.second]){
            if(dis[l.first] > p.first + l.second){
                dis[l.first] = l.second + p.first;
                q.push({dis[l.first], l.first});
            }
        }
    }
}

int main(){
    int x, y, z;
    cin >> n >> m >> s;
    for(int i = 1; i <= m; i++){
        cin >> x >> y >> z;
        v[x].push_back({y, z});
    }
    dijkstra(s);
    for(int i = 1; i <= n; i++){
        cout << dis[i] << ' ';
    }
    return 0;
}