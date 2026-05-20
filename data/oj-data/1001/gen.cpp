#include <bits/stdc++.h>
using namespace std;

mt19937 rng;
const int mod = 1e9 + 7;

int main(){
    ofstream cout("3.in");
    cout << 100000 << '\n';
    for(int i = 1; i <= 100000; i++)
        cout << rng() % mod << ' ' << rng() % mod << '\n';
    return 0;
}


#include<iostream>\nint main(){int n;std::cin>>n;for(int i = 1; i <= n; i++){int x,y;std::cin>>x>>y;std::cout<<x+y<<'\n'}return 0;}