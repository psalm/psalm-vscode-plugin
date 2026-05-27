<?php

declare(strict_types=1);

class Greeter
{
    public function __construct(
        private string $name,
    ) {}

    public function greet(): string
    {
        return "Hello, {$this->name}!";
    }
}

function add(int $a, int $b): int
{
    return $a + $b;
}

$greeter = new Greeter('World');
echo $greeter->greet() . PHP_EOL;
echo '2 + 3 = ' . add(2, 3) . PHP_EOL;

echo $greeter->thing();
