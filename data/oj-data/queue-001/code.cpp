#include<bits/stdc++.h>
using namespace std;

const int N = 1e5 + 10;

class queue_{
    public:
        void push(int x){
            a[++last] = x;
        }
        
        void pop(){
            if(first == last){
                cout<<"ERR_CANNOT_POP"<<endl;
            }else{
                first++;
            }
        }

        void query(){
            if(last == first){
                cout<<"ERR_CANNOT_QUERY"<<endl;
            }else{
                cout<<a[first + 1]<<endl;
            }
        }

        int size(){
            return last - first;
        }

    private:
        int a[N] = {0};
        int first = 0;
        int last = 0;
};

int main(){
    int n = 0;
    cin>>n;
    queue_ q;
    for(int i = 0; i < n; i++){
        int x = 0, y = 0;
        cin>>x;
        if(x == 1){
            cin>>y;
            q.push(y);
        }
        else if(x == 2){
            q.pop();
        }
        else if(x == 3){
            q.query();
        }
        else if(x == 4){
            cout<<q.size()<<endl;
        }
    }
    return 0;
}