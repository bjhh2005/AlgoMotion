#include <bits/stdc++.h>
using namespace std;

int main(){
    ifstream cin("3.in");
    ofstream cout("3.out");
    int n;
    cin >> n;
    for(int i = 1; i <= n; i++){
        int x, y;
        cin >> x >> y;
        cout << x + y << '\n';
    }
    return 0;
}