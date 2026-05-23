#include <bits/stdc++.h>
using namespace std;

vector <int> prefix_function(string s){
    int len = s.length();
    vector <int> pi(len);
    for(int i = 1; i < len; i++){
        int j = pi[i - 1];
        while(j > 0 && s[i] != s[j]) j = pi[j - 1];
        if(s[i] == s[j]) j++;
        pi[i] = j;
    }
    return pi;
}

int main(){
    ios::sync_with_stdio(0);
    cin.tie(0), cout.tie(0);
    string s1, s2;
    cin >> s1 >> s2;
    string s = s2 + '#' + s1;
    int len2 = s2.length(), len = s.length();
    vector <int> pi = prefix_function(s);
    for(int i = len2 + 1; i < len; i++){
        if(pi[i] == len2) cout << i - 2 * len2 + 1 << '\n';
    }
    vector <int> v = prefix_function(s2);
    for(auto l : v) cout << l << ' ';
    return 0;
}