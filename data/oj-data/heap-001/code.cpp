#include <bits/stdc++.h>
using namespace std;

const int N = 1e6 + 11;
int a[N];
int siz;

void push(int x){
    a[++siz] = x;
    int cnt = siz;
    while(cnt > 1 && a[cnt] < a[cnt >> 1]){
        swap(a[cnt], a[cnt >> 1]);
        cnt >>= 1;
    }
}

void pop(){
    swap(a[1], a[siz]);
    siz--;
    int cnt = 1;
    while(cnt * 2 <= siz){
        cnt <<= 1;
        if(cnt + 1 <= siz && a[cnt + 1] < a[cnt]) cnt++;
        if(a[cnt >> 1] < a[cnt]) break;
        else swap(a[cnt >> 1], a[cnt]); 
    }
}

int top(){
    return a[1];
}

int main(){
    int n;
    cin >> n;
    for(int i = 1; i <= n; i++){
        int op;
        cin >> op;
        if(op == 1){
            int x;
            cin >> x;
            push(x);
        }else if(op == 2){
            cout << top() << '\n';
        }else{
            pop();
        }
    }
    return 0;
}