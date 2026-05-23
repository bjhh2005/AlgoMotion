#include <bits/stdc++.h>
using namespace std;
#define ll long long

const int N = 5e5 + 11;
int a[N], num[N];
vector <int> v;
int n, len;
ll c[N];

int find(int x){
    int l = 0, r = len - 1;
    int ans = -1;
    while(l <= r){
        int mid = l + ((r - l) >> 1);
        if(v[mid] > x) r = mid - 1;
        else if(v[mid] < x) l = mid + 1;
        else{
            ans = mid;
            break;
        }
    }
    return ans;
}

inline int lowbit(int x){
    return x & -x;
}

inline void add(int x){
    while(x <= n){
        c[x]++;
        x += lowbit(x);
    }
}

inline ll getsum(int x){
    ll ans = 0ll;
    while(x > 0){
        ans += c[x];
        x -= lowbit(x);
    }
    return ans;
}

int main(){
    cin >> n;
    for(int i = 1; i <= n; i++){
        cin >> a[i];
        v.push_back(a[i]);
    }
    sort(v.begin(), v.end());
    v.erase(unique(v.begin(), v.end()), v.end());
    len = v.size();
    ll ans = 0ll;
    for(int i = n; i; i--){
        int x = find(a[i]) + 1;
        ans += getsum(x - 1);
        add(x);
    }
    cout << ans;
    return 0;
}