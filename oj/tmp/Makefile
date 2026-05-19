INCLUDE_PATH = include
CXXFLAGS = -I./include -O2 --std=c++17 -Wall -lstdc++fs

EXE_CHECKER = \
	/workspace/checker/bcmp \
	/workspace/checker/acmp \
	/workspace/checker/caseicmp \
	/workspace/checker/casencmp \
	/workspace/checker/casewcmp \
	/workspace/checker/dcmp \
	/workspace/checker/fcmp \
	/workspace/checker/hcmp \
	/workspace/checker/icmp \
	/workspace/checker/lcmp \
	/workspace/checker/ncmp \
	/workspace/checker/rcmp \
	/workspace/checker/rcmp4 \
	/workspace/checker/rcmp6 \
	/workspace/checker/rcmp9 \
	/workspace/checker/rncmp \
	/workspace/checker/uncmp \
	/workspace/checker/wcmp \
	/workspace/checker/yesno

all: $(EXE_CHECKER)

% : %.cpp
	$(CXX) $(CXXFLAGS) $(EXTRA_CXXFLAGS) $< -o $@

$(EXE_CHECKER): include/testlib.h

.PHONY: clean
clean:
	rm -f $(EXE_CHECKER)