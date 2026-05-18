# AlgoMotion Makefile
# 依赖: g++ (C++17) 以上 + jsoncpp

CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -Iinclude -Iexternal/json/include
LDFLAGS  = -Lexternal/json/lib -ljsoncpp
TARGET   = algomotion

SRCDIR   = src
OBJDIR   = obj

SOURCES  = $(wildcard $(SRCDIR)/*.cpp)
OBJECTS  = $(patsubst $(SRCDIR)/%.cpp, $(OBJDIR)/%.o, $(SOURCES))

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp
	@mkdir -p $(OBJDIR)
	$(CXX) $(CXXFLAGS) -c -o $@ $<

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf $(OBJDIR) $(TARGET)
