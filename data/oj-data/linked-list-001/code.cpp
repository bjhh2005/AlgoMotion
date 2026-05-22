#include <bits/stdc++.h>
using namespace std;

const int N = 1e6 + 11;
int a[N];

int main(){
    int q = 0;
    cin>>q;
    a[1] = 0;
    while(q--){
        int b = 0;
        cin>>b;
        if(b == 1){
            int x, y;
            cin>>x>>y;
            a[y] = a[x];
            a[x] = y;
        }else if(b == 2){
            int x;
            cin>>x;
            printf("%d\n", a[x]);
        }else if(b == 3){
            int x;
            cin>>x;
            int y = a[x];
            if(a[x] == 0) continue;
            a[x] = a[a[x]];
            a[y] = 0;
        }
    }
    return 0;
}